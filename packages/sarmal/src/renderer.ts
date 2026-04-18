import type {
  CurveDef,
  MorphOptions,
  Point,
  RendererOptions,
  SarmalInstance,
  TrailStyle,
} from "./types";
import {
  DEFAULT_MORPH_DURATION_MS,
  DEFAULT_SKELETON_OPACITY,
  computeBoundaries,
  computeTrailQuad,
  enginePassthroughs,
  getPaletteColor,
  resolvePalette,
} from "./renderer-shared";

export { computeTangent, computeNormal, TrailPoint } from "./renderer-shared";
export {
  Rgb,
  GRADIENT,
  PRESETS,
  hexToRgb,
  lerpRgb,
  getPaletteColor,
  resolvePalette,
} from "./renderer-shared";

const DEFAULT_SKELETON_COLOR = "#ffffff";

// TODO: accept rgb(a)
export function hexToRgbComponents(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
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
  const trailStyle: TrailStyle = options.trailStyle ?? "default";
  const trailColor = options.trailColor ?? "#ffffff";
  const palette = resolvePalette(options.palette, trailStyle);

  function defaultHeadColor(): string {
    if (trailStyle !== "default") {
      const { r, g, b } = getPaletteColor(palette, 1.0);
      return `rgb(${r},${g},${b})`;
    }
    return trailColor;
  }

  const opts = {
    skeletonColor: options.skeletonColor ?? DEFAULT_SKELETON_COLOR,
    trailColor,
    headColor: options.headColor ?? defaultHeadColor(),
  };

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
    // TODO: attach a ResizeObserver so this function can be called again for the right scale of canvas
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

  function calculateBoundaries() {
    const b = computeBoundaries(skeleton, logicalWidth, logicalHeight);
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
     * Ribbon approach: draw the trail as a sequence of filled quads.
     * Each quad connects two consecutive trail points with left/right offsets
     * based on the width at that position. Quads are drawn from tail to head
     * so later quads naturally overlay earlier ones.
     *
     * @see https://cesium.com/blog/2013/04/22/robust-polyline-rendering-with-webgl
     *      Cesium: "draw a screen-aligned quad for each segment... extrude them
     *      in screen space in the direction normal to the line."
     */
    const toX = (p: { x: number }) => p.x * scale + offsetX;
    const toY = (p: { y: number }) => p.y * scale + offsetY;
    for (let i = 0; i < trailCount - 1; i++) {
      const { l0x, l0y, r0x, r0y, l1x, l1y, r1x, r1y, opacity, progress } = computeTrailQuad(
        trail,
        i,
        trailCount,
        toX,
        toY,
      );

      // Determine fill color based on trail style
      if (trailStyle === "default") {
        ctx.fillStyle = `rgba(${trailRgb},${opacity})`;
      } else {
        const timeOffset = trailStyle === "gradient-animated" ? gradientAnimTime * 0.0005 : 0;
        const color = getPaletteColor(palette, progress, timeOffset);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${opacity})`;
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
    const r =
      options.headRadius ?? Math.max(2, 3 * Math.sqrt(Math.min(logicalWidth, logicalHeight) / 160));

    ctx.fillStyle = opts.headColor;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderFrame(deltaTime: number) {
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
      const bounds = computeBoundaries(interpolatedSkeleton, logicalWidth, logicalHeight);

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
  }

  function loop() {
    const now = performance.now();
    const deltaTime = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    renderFrame(deltaTime);
    animationId = requestAnimationFrame(loop);
  }

  // Initialize skeleton and offscreen canvas on creation
  skeleton = engine.getSarmalSkeleton();
  calculateBoundaries();

  if (!engine.isLiveSkeleton) {
    buildSkeletonCanvas();
  }

  // Handle initialT option: seek to the specified position before first frame
  if (options.initialT !== undefined) {
    engine.seek(options.initialT);
  }

  // Draw initial frame unconditionally (shows skeleton and initial position)
  renderFrame(0);

  // Handle autoStart option: start the animation loop unless explicitly disabled
  const shouldAutoStart = options.autoStart !== false;

  const instance = {
    play() {
      if (animationId !== null) {
        return;
      }

      lastTime = performance.now();
      loop();
    },

    pause() {
      if (animationId === null) {
        return;
      }

      cancelAnimationFrame(animationId);
      animationId = null;
      engine.cancelSpeedTransition();
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

    ...enginePassthroughs(engine),

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

  if (shouldAutoStart) {
    instance.play();
  }

  return instance;
}
