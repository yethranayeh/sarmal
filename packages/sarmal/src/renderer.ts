import type {
  CurveDef,
  MorphOptions,
  PalettePreset,
  Point,
  RendererOptions,
  SarmalInstance,
  TrailStyle,
} from "./types";

const DEFAULT_MORPH_DURATION_MS = 300;
const DEFAULT_HEAD_RADIUS = 4;
const DEFAULT_SKELETON_COLOR = "#ffffff";
const DEFAULT_SKELETON_OPACITY = 0.15;

/** Fraction of the bounding box added as padding when fitting the curve to the canvas */
const FIT_PADDING = 0.1;

/** Higher values = sharper fade near the tail, more of the trail appears faint */
const TRAIL_FADE_CURVE = 1.5;
const TRAIL_MAX_OPACITY = 0.88;
/** Line width of tail */
const TRAIL_MIN_WIDTH = 0.5;
/** Line width of head */
const TRAIL_MAX_WIDTH = 2.5;

const GRADIENT = {
  bard: ["#a855f7", "#3b82f6", "#14b8a6", "#ec4899"],
  sunset: ["#f97316", "#dc2626", "#9333ea", "#f472b6"],
  ocean: ["#1e3a8a", "#06b6d4", "#22d3ee", "#e0f2fe"],
  ice: ["#1e3a8a", "#67e8f9"],
  fire: ["#7f1d1d", "#fbbf24"],
  forest: ["#14532d", "#86efac"],
};

const PRESETS: Record<PalettePreset, string[]> = {
  bard: GRADIENT.bard,
  sunset: GRADIENT.sunset,
  ocean: GRADIENT.ocean,
  ice: GRADIENT.ice,
  fire: GRADIENT.fire,
  forest: GRADIENT.forest,
};

// ? exported for testing
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

// ? exported for testing
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}

// ? exported for testing
export const lerpRgb = (a: Rgb, b: Rgb, t: number) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

/**
 * Gets a color from a palette based on position (0-1) with optional time-based cycling
 * ? Exported for testing.
 */
export function getPaletteColor(palette: string[], position: number, timeOffset: number = 0): Rgb {
  if (palette.length === 0) return { r: 255, g: 255, b: 255 };
  if (palette.length === 1) return hexToRgb(palette[0]!);

  const cyclePos = (position + timeOffset) % 1;
  const scaled = cyclePos * palette.length;
  const idx = Math.floor(scaled);
  const t = scaled - idx;

  const c1 = hexToRgb(palette[idx % palette.length]!);
  const c2 = hexToRgb(palette[(idx + 1) % palette.length]!);

  return lerpRgb(c1, c2, t);
}

// ? exported for testing
export function resolvePalette(
  palette: PalettePreset | string[] | undefined,
  trailStyle: TrailStyle,
): string[] {
  if (Array.isArray(palette)) return palette;
  if (palette && palette in PRESETS) return PRESETS[palette as PalettePreset]!;
  return trailStyle === "gradient-animated" ? GRADIENT.bard : GRADIENT.ice;
}

// TODO: accept rgb(a)
export function hexToRgbComponents(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
}

export interface TrailPoint {
  x: number;
  y: number;
}

/**
 * Computes the unit tangent vector at a point on the trail
 * - For interior points, uses central difference (previous -> next)
 * - For endpoints, uses forward/backward difference
 *
 * @param trail Array of trail points
 * @param i Index of the point to compute tangent for
 * @returns Unit vector in the direction of travel at that point
 */
export function computeTangent(trail: TrailPoint[], i: number): TrailPoint {
  const count = trail.length;
  if (count < 2) {
    return { x: 1, y: 0 };
  }

  if (i === 0) {
    const dx = trail[1]!.x - trail[0]!.x;
    const dy = trail[1]!.y - trail[0]!.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  if (i === count - 1) {
    const dx = trail[count - 1]!.x - trail[count - 2]!.x;
    const dy = trail[count - 1]!.y - trail[count - 2]!.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  const dx = trail[i + 1]!.x - trail[i - 1]!.x;
  const dy = trail[i + 1]!.y - trail[i - 1]!.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Computes the unit normal vector at a point on the trail
 * The normal is perpendicular to the tangent, rotated 90° counter-clockwise.
 * This gives the "left" direction relative to the direction of travel.
 *
 * @param trail Array of trail points
 * @param i Index of the point to compute normal for
 * @returns Unit vector perpendicular to the trail at that point
 */
export function computeNormal(trail: TrailPoint[], i: number): TrailPoint {
  const tangent = computeTangent(trail, i);
  return { x: -tangent.y, y: tangent.x };
}

/**
 * ! Exported purely so `applyDprSizing` can be unit-tested without a DOM
 */
export interface DprSizingTarget {
  width: number;
  height: number;
  style: { width: string; height: string };
}

/**
 * Applies DPR sizing to a target
 *
 * ! DO NOT REMOVE THE `style.width` and `style.height` ASSIGNMENTS
 *
 * A canvas with only `width`/`height` HTML attributes and no CSS derives
 *  its displayed size from those attributes.
 * If we set `canvas.width = logicalWidth * dpr` to scale the drawing buffer for "crispness",
 *  the element ALSO visually grows by the DPR factor
 * ! The bug is silent and sneaky. It just resulsts in a broken render without any obvious reasons
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
 *      MDN: "If you don't set the CSS attributes, the intrinsic size of the canvas will be used as its display size"
 *
 * @see https://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
 *      "Every canvas has 2 sizes: the drawingbuffer (pixels) and the display
 *        size (CSS). If no CSS affects display size, it equals drawingbuffer."
 *
 * @see https://stackoverflow.com/questions/4938346/canvas-width-and-height-in-html5
 *      Phrogz: "If you don't set the CSS attributes, the intrinsic size of
 *        the canvas will be used as its display size."
 *
 * The regression test for this lives in **renderer.test.ts**
 */
export function applyDprSizing(
  target: DprSizingTarget,
  logicalWidth: number,
  logicalHeight: number,
  dpr: number,
): void {
  // Pin the CSS display size FIRST so changing the attributes below
  // cannot resize the element.
  target.style.width = `${logicalWidth}px`;
  target.style.height = `${logicalHeight}px`;

  target.width = logicalWidth * dpr;
  target.height = logicalHeight * dpr;
}

/**
 * Creates a Canvas 2D renderer for sarmal animations
 * Renders the skeleton and the trail
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
  };

  const trailStyle: TrailStyle = options.trailStyle ?? "default";
  const palette = resolvePalette(options.palette, trailStyle);
  const trailRgb = hexToRgbComponents(opts.trailColor);

  /**
   * Device pixel ratio for high-DPI displays.
   * We scale the canvas buffer size by DPR and apply a transform scale
   */
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  /**
   * Sets up the canvas for DPR scaling
   */
  function setupCanvas() {
    const rect = canvas.getBoundingClientRect();
    const lw = rect.width || 200;
    const lh = rect.height || 200;
    applyDprSizing(canvas, lw, lh, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setupCanvas();

  // Store logical dimensions for boundary calculations
  let logicalWidth = canvas.width / dpr;
  let logicalHeight = canvas.height / dpr;

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

  /** Accumulated time for "gradient-animated" trail style */
  let gradientAnimTime = 0;

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

    if (width === 0 && height === 0) {
      throw new Error(
        "[sarmal] Degenerate curve: all skeleton points are identical. " +
          "Check that your curve fn returns distinct points for different values of t.",
      );
    }

    const scaleX = logicalWidth / (width * (1 + FIT_PADDING * 2));
    const scaleY = logicalHeight / (height * (1 + FIT_PADDING * 2));
    const s = Math.min(scaleX, scaleY);
    const boundsWidth = width * s;
    const boundsHeight = height * s;
    return {
      scale: s,
      offsetX: (logicalWidth - boundsWidth) / 2 - minX * s,
      offsetY: (logicalHeight - boundsHeight) / 2 - minY * s,
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

    // Apply DPR scale to draw in logical coordinates
    skeletonCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
      /**
       * ! The offscreen buffer is *already* DPR-scaled, but the main ctx also has a DPR transform applied,
       * ! so passing natural pixel size would **double-scale** it.
       */
      ctx.drawImage(skeletonCanvas, 0, 0, logicalWidth, logicalHeight);
    }
  }

  function drawTrail() {
    if (trailCount < 2) {
      return;
    }

    /**
     * ! Claude's fix for the chopped looking curve trail
     *
     * Ribbon approach: draw the trail as a sequence of filled quads.
     * Each quad connects two consecutive trail points with left/right offsets
     * based on the width at that position. Quads are drawn from tail to head
     * so later quads naturally overlay earlier ones.
     *
     * @see https://mattdesl.svbtle.com/drawing-lines-is-hard
     *      DesLauriers: "Triangulated Lines" — expand points outward by half
     *      the thickness on either side using normals to create thick lines.
     *
     * @see https://cesium.com/blog/2013/04/22/robust-polyline-rendering-with-webgl
     *      Cesium: "draw a screen-aligned quad for each segment... extrude them
     *      in screen space in the direction normal to the line."
     */
    for (let i = 0; i < trailCount - 1; i++) {
      const progress = i / (trailCount - 1);
      const nextProgress = (i + 1) / (trailCount - 1);
      const alpha = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
      const width = TRAIL_MIN_WIDTH + progress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);
      const nextWidth = TRAIL_MIN_WIDTH + nextProgress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);

      const curr = trail[i]!;
      const next = trail[i + 1]!;
      const n0 = computeNormal(trail, i);
      const n1 = computeNormal(trail, i + 1);

      const halfW0 = width / 2;
      const halfW1 = nextWidth / 2;

      // Four corners of the quad: left0, left1, right1, right0
      // Left = +normal direction, Right = -normal direction
      const l0x = curr.x * scale + offsetX + n0.x * halfW0;
      const l0y = curr.y * scale + offsetY + n0.y * halfW0;
      const r0x = curr.x * scale + offsetX - n0.x * halfW0;
      const r0y = curr.y * scale + offsetY - n0.y * halfW0;

      const l1x = next.x * scale + offsetX + n1.x * halfW1;
      const l1y = next.y * scale + offsetY + n1.y * halfW1;
      const r1x = next.x * scale + offsetX - n1.x * halfW1;
      const r1y = next.y * scale + offsetY - n1.y * halfW1;

      // Determine fill color based on trail style
      if (trailStyle === "default") {
        ctx.fillStyle = `rgba(${trailRgb},${alpha})`;
      } else {
        const timeOffset = trailStyle === "gradient-animated" ? gradientAnimTime * 0.0005 : 0;
        const color = getPaletteColor(palette, progress, timeOffset);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
      }

      ctx.beginPath();
      ctx.moveTo(l0x, l0y);
      ctx.lineTo(l1x, l1y);
      ctx.lineTo(r1x, r1y);
      ctx.lineTo(r0x, r0y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHead() {
    if (!head) {
      return;
    }

    const x = head.x * scale + offsetX;
    const y = head.y * scale + offsetY;

    ctx.fillStyle = opts.headColor;
    ctx.beginPath();
    ctx.arc(x, y, opts.headRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const now = performance.now();
    const deltaTime = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    // Update gradient animation time for animated trail style
    if (trailStyle === "gradient-animated") {
      gradientAnimTime += deltaTime * 1000; // Convert to ms for consistent speed
    }

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

    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

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
