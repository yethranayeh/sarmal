import type { CurveDef, MorphOptions, Point, RendererOptions, SarmalInstance } from "./types";

const DEFAULT_MORPH_DURATION_MS = 300;
const DEFAULT_HEAD_RADIUS = 4;
// TODO: Re-evaluate glow implementation. Current approach looks TERRIBLE!
// Consider: remove glow entirely, replace with a sharper bloom, or make it opt-in only (default 0).
const DEFAULT_GLOW_SIZE = 20;
const DEFAULT_SKELETON_COLOR = "#ffffff";
const DEFAULT_SKELETON_OPACITY = 0.15;

/** Fraction of the bounding box added as padding when fitting the curve to the canvas */
const FIT_PADDING = 0.1;

/**
 * The trail is drawn in batches of points
 * Each batch has lower opacity than the one that comes before it
 *  (0 = oldest/tail, 1 = newest/head)
 *
 * ! Performance note: Larger batch size = fewer GPU stroke calls per frame
 */
const TRAIL_BATCH_SIZE = 20;
/** Higher values = sharper fade near the tail, more of the trail appears faint */
const TRAIL_FADE_CURVE = 1.5;
const TRAIL_MAX_OPACITY = 0.88;
/** Line width of tail */
const TRAIL_MIN_WIDTH = 0.5;
/** Line width of head */
const TRAIL_MAX_WIDTH = 2.5;

const GLOW_INNER_EDGE = 0.4;
/** Opacity at the inner edge of the glow falloff */
const GLOW_FALLOFF_OPACITY = 0.53;

/** Parses a hex color into its "r,g,b" string for use in rgba() — called once at init */
export function hexToRgbComponents(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

/**
 * Creates a Canvas 2D renderer for sarmal animations
 * Renders the skeleton, the trail, and the glowing dot
 */
export function createRenderer(options: RendererOptions): SarmalInstance {
  const canvas = options.canvas;
  if (!canvas.getContext("2d")) {
    throw new Error("Could not get 2d context from canvas");
  }
  const ctx = canvas.getContext("2d")!;

  const engine = options.engine;
  const opts = {
    skeletonColor: options.skeletonColor ?? DEFAULT_SKELETON_COLOR,
    trailColor: options.trailColor ?? "#ffffff",
    headColor: options.headColor ?? "#ffffff",
    headRadius: options.headRadius ?? DEFAULT_HEAD_RADIUS,
    glowSize: options.glowSize ?? DEFAULT_GLOW_SIZE,
  };

  const trailRgb = hexToRgbComponents(opts.trailColor);
  const headRgbFalloff = `rgba(${hexToRgbComponents(opts.headColor)},${GLOW_FALLOFF_OPACITY})`;

  let skeleton: Array<Point> = [];
  let skeletonCanvas: OffscreenCanvas | null = null;
  let trail: Array<Point> = [];
  let trailCount = 0;
  let head: Point | null = null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let animationId: number | null = null;
  let lastTime = 0;

  let morphResolve: (() => void) | null = null;
  let morphDurationMs = DEFAULT_MORPH_DURATION_MS;
  let morphAlpha = 0;

  /**
   * Computes how to map engine coordinates to canvas pixels.
   * Returns the transform values without mutating renderer state.
   *
   * Steps are roughly: curve fn -> coordinate point -> (scale + offset) -> pixel
   *
   * 1. Find the bounding box of the skeleton (min/max x/y in coordinates)
   * 2. Compute a scale factor within the bounds into the canvas with padding
   * 3. Compute offsets to center the curve in the canvas
   */
  function computeBoundaries(
    pts: Array<Point>,
  ): { scale: number; offsetX: number; offsetY: number } | null {
    if (pts.length === 0) return null;

    const first = pts[0]!;
    let minX = first.x,
      maxX = first.x,
      minY = first.y,
      maxY = first.y;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const scaleX = canvasWidth / (width * (1 + FIT_PADDING * 2));
    const scaleY = canvasHeight / (height * (1 + FIT_PADDING * 2));
    const s = Math.min(scaleX, scaleY);
    const boundsWidth = width * s;
    const boundsHeight = height * s;
    return {
      scale: s,
      offsetX: (canvasWidth - boundsWidth) / 2 - minX * s,
      offsetY: (canvasHeight - boundsHeight) / 2 - minY * s,
    };
  }

  function calculateBoundaries() {
    const b = computeBoundaries(skeleton);
    if (b) {
      scale = b.scale;
      offsetX = b.offsetX;
      offsetY = b.offsetY;
    }
  }

  /**
   * Draws the skeleton once into an OffscreenCanvas so that every frame
   * only needs a single ctx.drawImage() instead of rebuilding the full path.
   */
  function buildSkeletonCanvas() {
    if (skeleton.length < 2) return;

    skeletonCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    const skeletonCtx = skeletonCanvas.getContext("2d")!;

    skeletonCtx.strokeStyle = `rgba(${hexToRgbComponents(opts.skeletonColor)},${DEFAULT_SKELETON_OPACITY})`;
    skeletonCtx.lineWidth = 1.5;
    skeletonCtx.beginPath();

    const first = skeleton[0]!;
    skeletonCtx.moveTo(first.x * scale + offsetX, first.y * scale + offsetY);

    for (let i = 1; i < skeleton.length; i++) {
      const p = skeleton[i]!;
      skeletonCtx.lineTo(p.x * scale + offsetX, p.y * scale + offsetY);
    }

    skeletonCtx.stroke();
  }

  function drawSkeletonPath(pts: Array<Point>, opacity: number) {
    if (pts.length < 2) return;
    ctx.strokeStyle = `rgba(${hexToRgbComponents(opts.skeletonColor)},${opacity})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x * scale + offsetX, pts[0]!.y * scale + offsetY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i]!.x * scale + offsetX, pts[i]!.y * scale + offsetY);
    }
    ctx.stroke();
  }

  function drawSkeleton() {
    if (opts.skeletonColor === "transparent") {
      return;
    }

    if (engine.morphAlpha !== null) {
      // Draw the live lerped skeleton every frame so it always matches the current
      // scale/offset and correctly tracks live curves that change with actualTime
      drawSkeletonPath(engine.getSarmalSkeleton(), DEFAULT_SKELETON_OPACITY);
      return;
    }

    if (engine.isLiveSkeleton) {
      if (skeleton.length < 2) {
        return;
      }

      ctx.strokeStyle = `rgba(${hexToRgbComponents(opts.skeletonColor)},${DEFAULT_SKELETON_OPACITY})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      const first = skeleton[0]!;
      ctx.moveTo(first.x * scale + offsetX, first.y * scale + offsetY);

      for (let i = 1; i < skeleton.length; i++) {
        const p = skeleton[i]!;
        ctx.lineTo(p.x * scale + offsetX, p.y * scale + offsetY);
      }

      ctx.stroke();
    } else if (skeletonCanvas) {
      ctx.drawImage(skeletonCanvas, 0, 0);
    }
  }

  function drawTrail() {
    if (trailCount < 2) {
      return;
    }

    // Set constant state once outside the batch loop
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let batchIndex = 0; batchIndex < trailCount - 1; batchIndex += TRAIL_BATCH_SIZE) {
      const bEnd = Math.min(batchIndex + TRAIL_BATCH_SIZE, trailCount - 1);
      /** Normalized position of this batch along the trail (0 = tail, 1 = head) */
      const progress = (batchIndex + bEnd) / 2 / (trailCount - 1);
      const alpha = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
      const lineWidth = TRAIL_MIN_WIDTH + progress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);

      ctx.beginPath();
      for (let i = batchIndex; i <= bEnd; i++) {
        const point = trail[i]!;

        if (i === batchIndex) {
          ctx.moveTo(point.x * scale + offsetX, point.y * scale + offsetY);
        } else {
          ctx.lineTo(point.x * scale + offsetX, point.y * scale + offsetY);
        }
      }

      // ! AI Note
      // FIXME: still allocates a new string every batch every frame (~20x/frame).
      // `trailRgb` avoids re-parsing the hex, but alpha is a continuous float so the full
      // rgba string can't be pre-computed. Fix: discretize alpha into N buckets at init
      // and do a lookup (e.g. trailColors[Math.round(progress * N)]) instead of a template literal.
      ctx.strokeStyle = `rgba(${trailRgb},${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  function drawHead() {
    if (!head) {
      return;
    }

    const x = head.x * scale + offsetX;
    const y = head.y * scale + offsetY;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, opts.glowSize);
    gradient.addColorStop(0, opts.headColor);
    gradient.addColorStop(GLOW_INNER_EDGE, headRgbFalloff);
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, opts.glowSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = opts.headColor;
    ctx.beginPath();
    ctx.arc(x, y, opts.headRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const now = performance.now();
    const deltaTime = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    if (engine.morphAlpha !== null) {
      morphAlpha = Math.min(1, morphAlpha + deltaTime / (morphDurationMs / 1000));
      engine.setMorphAlpha(morphAlpha);

      /**
       * Compute bounds from the actual interpolated skeleton during morph
       * ! This ensures the curve stays properly centered and scaled
       */
      const interpolatedSkeleton = engine.getSarmalSkeleton();
      const bounds = computeBoundaries(interpolatedSkeleton);

      if (bounds) {
        scale = bounds.scale;
        offsetX = bounds.offsetX;
        offsetY = bounds.offsetY;
      }

      if (morphAlpha >= 1) {
        engine.completeMorph();
        morphResolve?.();
        morphResolve = null;
        morphAlpha = 0;

        skeleton = engine.getSarmalSkeleton();
        if (!engine.isLiveSkeleton) {
          buildSkeletonCanvas();
        }
      }
    }

    trail = engine.tick(deltaTime);
    trailCount = engine.trailCount;
    head = trailCount > 0 ? trail[trailCount - 1]! : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (engine.isLiveSkeleton && engine.morphAlpha === null) {
      skeleton = engine.getSarmalSkeleton();
      calculateBoundaries();
    }

    drawSkeleton();
    drawTrail();
    drawHead();

    animationId = requestAnimationFrame(render);
  }

  // Initialize skeleton and offscreen canvas on creation
  skeleton = engine.getSarmalSkeleton();
  calculateBoundaries();

  if (!engine.isLiveSkeleton) {
    buildSkeletonCanvas();
  }

  return {
    start() {
      if (animationId !== null) {
        return;
      }

      lastTime = performance.now();
      render();
    },

    stop() {
      if (animationId === null) {
        return;
      }

      cancelAnimationFrame(animationId);
      animationId = null;
    },

    reset() {
      engine.reset();
      trail = [];
      head = null;
    },

    destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },

    seek(t, options) {
      engine.seek(t, options);
    },

    seekWithTrail(t) {
      engine.seekWithTrail(t);
    },

    morphTo(target: CurveDef, options?: MorphOptions): Promise<void> {
      if (morphResolve !== null) {
        engine.completeMorph();
        morphResolve();
        morphResolve = null;
        morphAlpha = 0;
      }

      morphDurationMs = options?.duration ?? DEFAULT_MORPH_DURATION_MS;
      morphAlpha = 0;

      engine.startMorph(target, options?.morphStrategy);

      return new Promise<void>((resolve) => {
        morphResolve = resolve;
      });
    },
  };
}
