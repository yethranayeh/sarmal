import type {
  BaseRendererOptions,
  CurveDef,
  DotMatrixRuntimeRenderOptions,
  MorphOptions,
  SarmalInstance,
  TrailColor,
  TrailStyle,
} from "./types";
import type { Rgb } from "./renderer-shared";
import { createEngine } from "./engine";
import {
  DEFAULT_MORPH_DURATION_MS,
  colorToRgb,
  computeBoundaries,
  enginePassthroughs,
  validateBaseRenderOptions,
} from "./renderer-shared";

/**
 * How many brightness levels to group dots into when drawing.
 *
 * Instead of one canvas draw call per lit dot, dots with similar brightness
 *  are batched into the same path and filled in one call.
 * 8 buckets means at most 8 fill calls per frame for the lit portion of the grid,
 *  regardless of how many dots are lit.
 */
const NUM_BUCKETS = 8;

export interface DotMatrixSarmalOptions extends Pick<
  BaseRendererOptions,
  "autoStart" | "pauseOnHidden" | "initialPhase"
> {
  /**
   * Number of dot columns in the grid.
   * @default 32
   */
  cols?: number;
  /**
   * Number of dot rows in the grid.
   * @default 32
   */
  rows?: number;
  /**
   * Controls the corner rounding of each dot.
   * `0` renders as a sharp-cornered square,
   * `1` renders as a full circle.
   * Values between `0` and `1` give rounded rectangles.
   * @default 1
   */
  roundness?: number;
  /**
   * Number of trail points to keep.
   * Larger values mean the trail extends further back from the head.
   * @default cols * 3
   */
  trailLength?: number;
  /**
   * Color of lit dots. Single color string for solid mode; array of two or more colors for gradient mode.
   * Gradient mode samples a color per dot based on its position in the trail (tail → head).
   * Background dots always use the first color at 5% opacity.
   * @default '#ffffff'
   */
  trailColor?: TrailColor;
  /**
   * Trail rendering style.
   * - `'default'` — solid color, alpha varies by intensity.
   * - `'gradient-static'` — each dot's color is sampled from the `trailColor` gradient. Requires `trailColor` array.
   * - `'gradient-animated'` — same as `gradient-static` but the gradient phase shifts over time.
   * @default 'default'
   */
  trailStyle?: TrailStyle;
}

/**
 * Creates a dot matrix renderer for a sarmal animation on a canvas element.
 *
 * The renderer maps the animation's trail to a grid of dots.
 * Each frame, the grid is cleared and rebuilt: dots near the head of the trail are bright,
 *  dots near the tail are dim, and dots with no trail activity are barely visible (5% opacity).
 *
 * Grid geometry is derived from `cols` and `rows`.
 * For example, a 240x240 canvas with `cols: 32, rows: 32` produces 1024 dots with cells approximately 7.5x7.5 px each.
 *
 * The background layer (all dim dots) is pre-rendered to an OffscreenCanvas at init and
 *  restored each frame with a single `drawImage` call.
 * Lit dots are batched by brightness level,
 *  so the total draw calls per frame is around 10–12 regardless of grid size.
 *
 * @param canvas - The canvas element to draw into.
 *                 Its `width` and `height` HTML attributes determine the rendering area.
 *                 CSS display size is not read.
 * @param curveDef - The curve to animate.
 * @param options - Optional configuration for grid size, color, roundness, and lifecycle.
 * @returns A `SarmalInstance` with the standard `play` / `pause` / `destroy` / `morphTo` interface.
 *
 * @example
 * ```ts
 * import { createSarmalDotMatrix, curves } from '@sarmal/core'
 *
 * const instance = createSarmalDotMatrix(canvas, curves.lissajous43, {
 *   cols: 32,
 *   rows: 32,
 *   trailColor: '#2dd4bf',
 * })
 * ```
 */
export function createSarmalDotMatrix(
  canvas: HTMLCanvasElement,
  curveDef: CurveDef,
  options?: DotMatrixSarmalOptions,
): SarmalInstance<DotMatrixRuntimeRenderOptions> {
  const {
    cols = 32,
    rows = 32,
    roundness = 1,
    trailLength: trailLengthOpt,
    trailColor: initialColor = "#ffffff",
    trailStyle: initialTrailStyle = "default",
    autoStart = true,
    pauseOnHidden: pauseOnHiddenOpt = true,
    initialPhase,
  } = options ?? {};

  const trailLength = trailLengthOpt ?? cols * 3;
  const engine = createEngine(curveDef, trailLength);

  if (!canvas.getContext("2d")) {
    throw new Error("[sarmal] Could not get 2d context from canvas");
  }
  const ctx = canvas.getContext("2d")!;

  const W = canvas.width;
  const H = canvas.height;
  const cellW = W / cols;
  const cellH = H / rows;
  // Dot radius is 36% of the smaller cell dimension.
  // It is large enough to be clearly visible without adjacent dots overlapping even at coarse grid densities
  const dotR = Math.min(cellW, cellH) * 0.36;

  // Gradient state: null = solid mode, array of parsed RGB stops = gradient mode.
  let gradientRgb: Array<Rgb> | null;
  if (Array.isArray(initialColor)) {
    validateBaseRenderOptions({ trailColor: initialColor }); // ensures length >= 2 before map
    gradientRgb = initialColor.map(colorToRgb);
  } else {
    gradientRgb = null;
  }
  let colorRgb = gradientRgb ? gradientRgb[0]! : colorToRgb(initialColor as string);
  let currentTrailStyle: TrailStyle = initialTrailStyle;
  // Accumulated seconds; incremented each frame only in 'gradient-animated' mode.
  let animTime = 0;
  const ANIM_PERIOD = 6;

  // Flat buffer: one intensity value (0–1) per grid cell, indexed as row * cols + col.
  // 0 means the trail is not touching this cell,
  // >0 means the trail passes through it,
  // with 1 being the brightest (head of trail) and small values being the dimmest (tail).
  const grid = new Float32Array(cols * rows);

  // Coordinate mapping: engine math space to pixel space.
  // Recomputed from the skeleton so the curve fits within the canvas regardless of its range.
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  let bgCanvas: OffscreenCanvas | null = null;
  let animationId: number | null = null;
  let lastTime = 0;
  let pausedByVisibility = false;

  // Morph state: same pattern as the canvas renderer
  let morphResolve: (() => void) | null = null;
  let morphReject: ((error: Error) => void) | null = null;
  let morphDurationMs = DEFAULT_MORPH_DURATION_MS;
  let morphProgress = 0;

  /**
   * Draws all grid dots at very low opacity (5%) onto an OffscreenCanvas.
   * This canvas is used as the starting point for each frame.
   * Restored in one drawImage call, so we never have to iterate all cells at draw time just to paint the background.
   * Rebuilt when the trail color changes, since background dots share the same hue.
   */
  function buildBgCanvas() {
    bgCanvas = new OffscreenCanvas(W, H);
    const bgCtx = bgCanvas.getContext("2d")!;
    const bg = gradientRgb ? gradientRgb[0]! : colorRgb;
    bgCtx.fillStyle = `rgba(${bg.r},${bg.g},${bg.b},0.05)`;
    bgCtx.beginPath();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        bgCtx.roundRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2, roundness * dotR);
      }
    }
    bgCtx.fill();
  }

  function sampleGradientRgb(stops: Array<Rgb>, t: number): Rgb {
    const n = stops.length;
    const scaled = Math.max(0, Math.min(1, t)) * (n - 1);
    const i = Math.min(Math.floor(scaled), n - 2);
    const a = stops[i]!;
    const bStop = stops[i + 1]!;
    const mix = scaled - i;

    return {
      r: Math.round(a.r + (bStop.r - a.r) * mix),
      g: Math.round(a.g + (bStop.g - a.g) * mix),
      b: Math.round(a.b + (bStop.b - a.b) * mix),
    };
  }

  /**
   * Recomputes the scale and offset needed to map engine coordinates into this canvas.
   * The engine produces coordinates in math space (roughly [-1, 1] for most curves, but not always).
   * `computeBoundaries` finds the bounding box of the full curve and
   *    returns a uniform scale + centering offset so the curve fills the canvas with consistent padding.
   */
  function calculateBoundaries(skel: Array<{ x: number; y: number }>) {
    const b = computeBoundaries(skel, W, H);
    if (b) {
      scale = b.scale;
      offsetX = b.offsetX;
      offsetY = b.offsetY;
    }
  }

  /**
   * Maps a point in engine math space to a grid cell index [col, row].
   *
   * The flow is: engine coords to pixel coords (by scale + offset) to grid cell index.
   * The result is clamped so it always falls within the grid bounds.
   */
  function mapPt(x: number, y: number): [number, number] {
    const px = x * scale + offsetX;
    const py = y * scale + offsetY;
    return [
      Math.max(0, Math.min(cols - 1, Math.round((px / W) * (cols - 1)))),
      Math.max(0, Math.min(rows - 1, Math.round((py / H) * (rows - 1)))),
    ];
  }

  /**
   * Writes an intensity value to a grid cell, keeping whichever is higher.
   * A single cell can be stamped multiple times. The brightest value wins.
   */
  function stamp(c: number, r: number, intensity: number) {
    const idx = r * cols + c;
    if (intensity > grid[idx]!) {
      grid[idx] = intensity;
    }
  }

  /**
   * Clears the grid and rebuilds it from the current trail.
   *
   * Tail points get low intensity (near 0),
   *  the head gets intensity 1
   *
   * Gap fill: consecutive trail points can skip grid cells when the curve moves fast
   *  relative to the grid density.
   * This is visible as gaps in the trail at coarse grids.
   *
   * We prevent this by linearly interpolating between adjacent trail points at sub-cell
   *  resolution and stamping every intermediate cell.
   */
  function buildGrid(deltaTime: number) {
    const trail = engine.tick(deltaTime);
    const count = engine.trailCount;

    grid.fill(0);

    for (let i = 0; i < count; i++) {
      const pt = trail[i]!;
      const intensity = (i + 1) / count;
      const [c, r] = mapPt(pt.x, pt.y);
      stamp(c, r, intensity);

      if (i < count - 1) {
        const next = trail[i + 1]!;
        const [nc, nr] = mapPt(next.x, next.y);
        // Number of interpolated steps scales with how far apart the two cells are.
        // Multiplying by 2 ensures we never skip a cell even on diagonal moves.
        const steps = Math.ceil(Math.max(Math.abs(nc - c), Math.abs(nr - r))) * 2;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const ix = pt.x + (next.x - pt.x) * t;
          const iy = pt.y + (next.y - pt.y) * t;
          const ii = intensity + (1 / count) * t;
          const [ic, ir] = mapPt(ix, iy);
          stamp(ic, ir, ii);
        }
      }
    }
  }

  /**
   * Draws the current grid state to the canvas.
   *
   * The background (all dim dots) is restored with a single drawImage call.
   * Lit dots are then drawn on top, batched into `NUM_BUCKETS` brightness groups
   * so that all dots at similar intensity share one path and one fill call.
   * This keeps the total number of canvas draw calls around 10–12 per frame.
   */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // One drawImage restores the full background instead of iterating all cells
    if (bgCanvas) {
      ctx.drawImage(bgCanvas, 0, 0);
    }

    // TODO: Consider alternative putImageData approach
    //       Pre-compute at init which pixels belong to each cell's dot (pixel mask lookup table).
    //       Each frame, write RGBA values into a Uint8ClampedArray based on grid intensities,
    //        then call ctx.putImageData(imageData, 0, 0) once.
    //       Would eliminates all per-frame draw calls at the cost of manual rasterization (no anti-aliasing on dot edges).
    //       Worth exploring for very fine grids (56x56+) or many simultaneous instances.

    const animOffset =
      currentTrailStyle === "gradient-animated"
        ? Math.abs(((animTime / ANIM_PERIOD) % 2) - 1) * 0.35
        : 0;

    for (let bucket = 0; bucket < NUM_BUCKETS; bucket++) {
      const lo = bucket / NUM_BUCKETS;
      const hi = (bucket + 1) / NUM_BUCKETS;
      const midpoint = (lo + hi) / 2;
      // Use the midpoint of the bucket range as the alpha for all dots in this group.
      const alpha = 0.08 + midpoint * 0.92;

      let hasLit = false;
      ctx.beginPath();

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const intensity = grid[row * cols + col]!;
          if (intensity > lo && intensity <= hi) {
            const cx = (col + 0.5) * cellW;
            const cy = (row + 0.5) * cellH;
            ctx.roundRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2, roundness * dotR);
            hasLit = true;
          }
        }
      }

      if (hasLit) {
        if (gradientRgb !== null) {
          const t = (((midpoint + animOffset) % 1) + 1) % 1;
          const { r, g, b } = sampleGradientRgb(gradientRgb, t);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          const { r, g, b } = colorRgb;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.globalAlpha = alpha;
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Advances the simulation by `deltaTime` seconds and redraws the canvas.
   * Handles morph progress and live-skeleton boundary updates the same way the canvas renderer does.
   */
  function renderFrame(deltaTime: number) {
    if (engine.morphAlpha !== null) {
      morphProgress = Math.min(1, morphProgress + deltaTime / (morphDurationMs / 1000));
      engine.setMorphAlpha(morphProgress);
      // Boundaries must track the interpolated skeleton during morph so the curve stays centered
      calculateBoundaries(engine.getSarmalSkeleton());

      if (morphProgress >= 1) {
        engine.completeMorph();
        morphResolve?.();
        morphResolve = null;
        morphReject = null;
        morphProgress = 0;
        calculateBoundaries(engine.getSarmalSkeleton());
      }
    } else if (engine.isLiveSkeleton) {
      calculateBoundaries(engine.getSarmalSkeleton());
    }

    if (currentTrailStyle === "gradient-animated") {
      animTime += deltaTime;
    }

    buildGrid(deltaTime);
    draw();
  }

  // Accept the rAF timestamp so tests can drive time manually by passing a controlled value.
  // Falls back to performance.now() when called directly (e.g. from play()).
  function loop(timestamp: number = performance.now()) {
    // Cap dt at 1/30s to prevent large jumps after the tab was backgrounded
    const deltaTime = Math.min((timestamp - lastTime) / 1000, 1 / 30);
    lastTime = timestamp;
    renderFrame(deltaTime);
    animationId = requestAnimationFrame(loop);
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  calculateBoundaries(engine.getSarmalSkeleton());
  buildBgCanvas();

  if (initialPhase !== undefined) {
    engine.seek(initialPhase);
  }

  renderFrame(0);

  // ── Instance ─────────────────────────────────────────────────────────────────

  const instance: SarmalInstance<DotMatrixRuntimeRenderOptions> = {
    /** Starts the animation loop. Does nothing if already running. */
    play() {
      if (animationId !== null) return;
      lastTime = performance.now();
      loop();
    },

    /** Pauses the animation loop. Preserves current trail state. */
    pause() {
      if (animationId === null) return;
      cancelAnimationFrame(animationId);
      animationId = null;
      engine.cancelSpeedTransition();
    },

    /** Resets the animation to the start of the curve and clears the grid. */
    reset() {
      engine.reset();
      grid.fill(0);
    },

    /** Stops the animation and removes all event listeners. */
    destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (morphReject !== null) {
        morphReject(new Error("[sarmal] Instance destroyed during morph"));
        morphResolve = null;
        morphReject = null;
      }
    },

    ...enginePassthroughs(engine),

    /**
     * Smoothly transitions from the current curve to `target`.
     * If a morph is already in progress, it is snapped to completion before the new one starts.
     * @returns A Promise that resolves when the transition finishes.
     */
    morphTo(target: CurveDef, opts?: MorphOptions): Promise<void> {
      if (morphResolve !== null) {
        engine.completeMorph();
        morphResolve();
        morphResolve = null;
        morphReject = null;
        morphProgress = 0;
      }

      morphDurationMs = opts?.duration ?? DEFAULT_MORPH_DURATION_MS;
      morphProgress = 0;
      engine.startMorph(target, opts?.morphStrategy);

      return new Promise<void>((resolve, reject) => {
        morphResolve = resolve;
        morphReject = reject;
      });
    },

    /**
     * Updates render options on a live instance without stopping the animation.
     *
     * Supported: `trailColor` and `trailStyle`.
     * ! Unsupported fields (`headColor`, `skeletonColor`, `headRadius`, `trailWidth`) throw.
     * ! Validation fails the entire call if any field is invalid, leaving options unchanged.
     */
    setRenderOptions(partial: DotMatrixRuntimeRenderOptions): void {
      validateBaseRenderOptions(partial);

      let needsRebuildBg = false;

      if (partial.trailColor !== undefined) {
        if (Array.isArray(partial.trailColor)) {
          gradientRgb = partial.trailColor.map(colorToRgb);
          colorRgb = gradientRgb[0]!;
        } else {
          gradientRgb = null;
          colorRgb = colorToRgb(partial.trailColor);
        }
        needsRebuildBg = true;
      }

      if (partial.trailStyle !== undefined) {
        currentTrailStyle = partial.trailStyle;
        if (currentTrailStyle === "default") {
          animTime = 0;
        }
      }

      if (needsRebuildBg) {
        buildBgCanvas();
      }

      if (currentTrailStyle !== "default" && gradientRgb === null) {
        console.warn(
          "[sarmal] dot matrix: gradient trailStyle has no effect without a trailColor array",
        );
      }
    },
  };

  // ── Visibility handling ──────────────────────────────────────────────────────

  function handleVisibilityChange() {
    if (document.hidden) {
      if (animationId !== null) {
        instance.pause();
        pausedByVisibility = true;
      }
    } else {
      if (pausedByVisibility) {
        pausedByVisibility = false;
        instance.play();
      }
    }
  }

  if (pauseOnHiddenOpt) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  const shouldAutoStart = autoStart !== false;
  // Skip auto-start if the tab is already hidden. The visibilitychange listener will resume it
  const actuallyAutoStart = shouldAutoStart && !(pauseOnHiddenOpt && document.hidden);

  if (actuallyAutoStart) {
    instance.play();
  } else if (shouldAutoStart) {
    pausedByVisibility = true;
  }

  return instance;
}
