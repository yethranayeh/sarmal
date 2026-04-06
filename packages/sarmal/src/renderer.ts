import type { Point, RendererOptions, SarmalInstance } from "./types";

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

  /**
   * Computes how to map engine coordinates to canvas pixels
   *
   * Steps are roughly: curve fn -> coordinate point -> (scale + offset) -> pixel
   *
   * 1. Find the bounding box of the skeleton (min/max x/y in coordinates)
   * 2. Compute a scale factor within the bounds into the canvas with padding
   * 3. Compute offsets to center the curve in the canvas
   */
  function calculateBoundaries() {
    if (skeleton.length === 0) {
      return;
    }

    const first = skeleton[0]!;
    let minX = first.x,
      maxX = first.x,
      minY = first.y,
      maxY = first.y;
    for (const p of skeleton) {
      if (p.x < minX) {
        minX = p.x;
      }

      if (p.x > maxX) {
        maxX = p.x;
      }

      if (p.y < minY) {
        minY = p.y;
      }

      if (p.y > maxY) {
        maxY = p.y;
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const scaleX = canvasWidth / (width * (1 + FIT_PADDING * 2));
    const scaleY = canvasHeight / (height * (1 + FIT_PADDING * 2));
    scale = Math.min(scaleX, scaleY);

    const boundsWidth = width * scale;
    const boundsHeight = height * scale;
    offsetX = (canvasWidth - boundsWidth) / 2 - minX * scale;
    offsetY = (canvasHeight - boundsHeight) / 2 - minY * scale;
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

  function drawSkeleton() {
    if (!skeletonCanvas || opts.skeletonColor === "transparent") {
      return;
    }

    ctx.drawImage(skeletonCanvas, 0, 0);
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

    trail = engine.tick(deltaTime);
    trailCount = engine.trailCount;
    head = trailCount > 0 ? trail[trailCount - 1]! : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawSkeleton();
    drawTrail();
    drawHead();

    animationId = requestAnimationFrame(render);
  }

  // Initialize skeleton and offscreen canvas on creation
  skeleton = engine.getSarmalSkeleton();
  calculateBoundaries();
  buildSkeletonCanvas();

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
  };
}
