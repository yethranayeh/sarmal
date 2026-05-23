import type {
  BaseRendererOptions,
  CurveDef,
  DotMatrixRuntimeRenderOptions,
  MorphOptions,
  SarmalInstance,
  TrailColor,
  TrailStyle,
} from "./types";
import type { Oklab, Rgb } from "./renderer-shared";

import { createEngine } from "./engine";
import {
  DEFAULT_MORPH_DURATION_MS,
  DEFAULT_SKELETON_OPACITY,
  colorToRgb,
  computeBoundaries,
  enginePassthroughs,
  getPaletteColor,
  oklabToRgb,
  parseColorToOklab,
  validateBaseRenderOptions,
} from "./renderer-shared";

export interface DotMatrixSarmalOptions extends Pick<
  BaseRendererOptions,
  "autoStart" | "pauseOnHidden" | "initialPhase" | "skeletonColor"
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
 * At init, a pixel mask is computed that records which canvas pixels belong to each dot.
 * Each frame, RGBA values are written directly into a typed array (one entry per lit pixel)
 *  and flushed to the canvas with a single `ctx.putImageData` call.
 * Frame cost is flat regardless of how many dots are lit or what grid size is used.
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
    skeletonColor: skeletonColorOpt = "#ffffff",
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

  // Gradient state: `null` is solid mode,
  //  with Oklab stops, it becomes gradient mode
  // Oklab interpolation avoids the gray dead zone that sRGB gradients produce.
  let gradientOklab: Array<Oklab> | null = null;
  // Primary color in Rgb, used for solid mode and as the background dot hue in gradient mode.
  // Initialized by `applyColor()` in the init block below
  let colorRgb: Rgb = { r: 255, g: 255, b: 255 };
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

  // Pixel mask: flat-packed arrays mapping each dot index to its RGBA byte offsets in canvas pixel space.
  // Computed once at init so `draw()` never needs to do geometry math.
  let pixelMaskStarts: Uint32Array = new Uint32Array(0);
  let pixelMaskLengths: Uint32Array = new Uint32Array(0);
  let pixelMaskIndices: Uint32Array = new Uint32Array(0);
  // Per-pixel antialiasing coverage (0.0–1.0),
  //    precomputed through 4x4 SSAA.
  // Interior pixels = 1.0
  //    edge pixels have a fraction that fades alpha smoothly.
  let pixelMaskCoverages: Float32Array = new Float32Array(0);
  // bgImageData: all dots at 5% opacity which are restored at the start of every frame. Rebuilt on color change.
  // frameImageData: working buffer, overwritten completely each frame. Allocated once at init.
  let bgImageData: ImageData | null = null;
  let frameImageData: ImageData | null = null;

  // Skeleton state: which dots are "on" the skeleton, and the parsed skeleton color.
  // `skeletonDotGrid` is a flat boolean mask (0 or 1) over the grid, updated whenever boundaries change.
  // `skeletonColorOklab` is null when skeleton is 'transparent' (disabled)
  let skeletonColorOklab: Oklab | null = null;
  const skeletonDotGrid = new Uint8Array(cols * rows);

  let animationId: number | null = null;
  let lastTime = 0;
  let pausedByVisibility = false;

  // Morph state: same pattern as the canvas renderer
  let morphResolve: (() => void) | null = null;
  let morphReject: ((error: Error) => void) | null = null;
  let morphDurationMs = DEFAULT_MORPH_DURATION_MS;
  let morphProgress = 0;

  /**
   * Pre-computes which canvas pixels belong to each dot using a rounded-rectangle SDF,
   *  with 4x4 supersampled antialiasing coverage.
   *
   * For each pixel in every dot's bounding box, 16 sub-sample points are tested against the SDF.
   * The fraction that pass (0.0625–1.0) is stored as that pixel's coverage.
   * Edge pixels fade out smoothly instead of snapping to binary inside/outside,
   *  so all dot shapes look correctly antialiased regardless of radius.
   *
   * Results are stored in TypedArrays for cache friendly access in draw().
   * ! Must be called once before `buildBgImageData()`
   */
  function computePixelMask() {
    const starts = new Uint32Array(cols * rows);
    const lengths = new Uint32Array(cols * rows);
    const allIndices: number[] = [];
    const allCoverages: number[] = [];
    const cornerR = roundness * dotR;
    const cornerR2 = cornerR * cornerR;
    // 4x4 SSAA: 16 sub-samples per pixel, each offset by (i+0.5)/4 within the pixel
    const SSAA = 4;
    const SSAA2 = SSAA * SSAA;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const dotIdx = row * cols + col;
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        // Extend bounding box by one pixel so edge sub-samples are captured
        const x0 = Math.max(0, Math.floor(cx - dotR - 1));
        const x1 = Math.min(W - 1, Math.ceil(cx + dotR + 1));
        const y0 = Math.max(0, Math.floor(cy - dotR - 1));
        const y1 = Math.min(H - 1, Math.ceil(cy + dotR + 1));

        starts[dotIdx] = allIndices.length;
        let count = 0;
        for (let py = y0; py <= y1; py++) {
          for (let px = x0; px <= x1; px++) {
            let hits = 0;
            for (let sy = 0; sy < SSAA; sy++) {
              const spyCenter = py + (sy + 0.5) / SSAA;
              for (let sx = 0; sx < SSAA; sx++) {
                const spxCenter = px + (sx + 0.5) / SSAA;
                // Generalized rounded-rect SDF:
                //   roundness=0 (square), roundness=1 (full circle)
                const dx = Math.max(Math.abs(spxCenter - cx) - (dotR - cornerR), 0);
                const dy = Math.max(Math.abs(spyCenter - cy) - (dotR - cornerR), 0);
                if (dx * dx + dy * dy <= cornerR2) {
                  hits++;
                }
              }
            }

            if (hits > 0) {
              allIndices.push((py * W + px) * 4);
              allCoverages.push(hits / SSAA2);
              count++;
            }
          }
        }
        lengths[dotIdx] = count;
      }
    }

    pixelMaskStarts = starts;
    pixelMaskLengths = lengths;
    pixelMaskIndices = new Uint32Array(allIndices);
    pixelMaskCoverages = new Float32Array(allCoverages);
  }

  /**
   * Builds the background ImageData (all dots at 5% opacity).
   * Rebuilt whenever trailColor changes since background dots share the trail hue.
   * ! Must be called after `computePixelMask()`
   */
  function buildBgImageData() {
    bgImageData = new ImageData(W, H);

    const bg = colorRgb;
    const baseAlpha = 0.05 * 255;
    const { data } = bgImageData;
    const n = cols * rows;

    for (let dotIdx = 0; dotIdx < n; dotIdx++) {
      const start = pixelMaskStarts[dotIdx]!;
      const len = pixelMaskLengths[dotIdx]!;

      for (let k = 0; k < len; k++) {
        const px = pixelMaskIndices[start + k]!;
        const coverage = pixelMaskCoverages[start + k]!;
        data[px] = bg.r;
        data[px + 1] = bg.g;
        data[px + 2] = bg.b;
        data[px + 3] = Math.round(baseAlpha * coverage);
      }
    }
  }

  function applyColor(color: TrailColor) {
    if (Array.isArray(color)) {
      gradientOklab = color.map((c) => parseColorToOklab(c)!);
      colorRgb = oklabToRgb(gradientOklab[0]!);
    } else {
      gradientOklab = null;
      colorRgb = colorToRgb(color);
    }
  }

  function applySkeletonColor(color: string) {
    skeletonColorOklab = color === "transparent" ? null : parseColorToOklab(color)!;
  }

  /**
   * Marks which grid cells the skeleton path passes through.
   * Uses the same `mapPt` + gap-fill logic as `buildGrid` so the skeleton
   *  traces the same cells the trail would trace over a full period.
   * Mutates `skeletonDotGrid`. Called at init and whenever boundaries change.
   */
  function computeSkeletonGrid(skel: Array<{ x: number; y: number }>) {
    skeletonDotGrid.fill(0);
    const count = skel.length;
    for (let i = 0; i < count; i++) {
      const pt = skel[i]!;
      const [c, r] = mapPt(pt.x, pt.y);
      skeletonDotGrid[r * cols + c] = 1;

      if (i < count - 1) {
        const next = skel[i + 1]!;
        const [nc, nr] = mapPt(next.x, next.y);
        const steps = Math.ceil(Math.max(Math.abs(nc - c), Math.abs(nr - r))) * 2;

        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const ix = pt.x + (next.x - pt.x) * t;
          const iy = pt.y + (next.y - pt.y) * t;
          const [ic, ir] = mapPt(ix, iy);
          skeletonDotGrid[ir * cols + ic] = 1;
        }
      }
    }
  }

  /**
   * Writes skeleton dot pixels into `data` at `DEFAULT_SKELETON_OPACITY`, coverage-weighted.
   * If `skeletonColorOklab` is `null` (transparent), nothing happens
   * Called every frame in `draw()` before the trail pass so trail always overwrites skeleton.
   */
  function writeSkeletonPixels(data: Uint8ClampedArray) {
    if (skeletonColorOklab === null) {
      return;
    }

    const { r, g, b } = oklabToRgb(skeletonColorOklab);
    const skelBaseAlpha = DEFAULT_SKELETON_OPACITY * 255;
    const n = cols * rows;

    for (let dotIdx = 0; dotIdx < n; dotIdx++) {
      if (!skeletonDotGrid[dotIdx]) {
        continue;
      }

      const start = pixelMaskStarts[dotIdx]!;
      const len = pixelMaskLengths[dotIdx]!;

      for (let k = 0; k < len; k++) {
        const px = pixelMaskIndices[start + k]!;
        const coverage = pixelMaskCoverages[start + k]!;
        data[px] = r;
        data[px + 1] = g;
        data[px + 2] = b;
        data[px + 3] = Math.round(skelBaseAlpha * coverage);
      }
    }
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
   * Restores the background ImageData (all dim dots at 5% opacity),
   *  then writes lit dot pixels directly into the frame buffer at their exact intensity and color,
   *    flushing once with `putImageData`
   * Total canvas API calls per frame: 1
   */
  function draw() {
    if (!bgImageData || !frameImageData) {
      return;
    }

    frameImageData.data.set(bgImageData.data);
    const { data } = frameImageData;

    writeSkeletonPixels(data);

    const timeOffset = currentTrailStyle === "gradient-animated" ? animTime / ANIM_PERIOD : 0;

    const n = cols * rows;
    for (let dotIdx = 0; dotIdx < n; dotIdx++) {
      const intensity = grid[dotIdx]!;
      if (intensity <= 0) {
        continue;
      }

      let r: number, g: number, b: number;
      if (gradientOklab !== null) {
        ({ r, g, b } = oklabToRgb(getPaletteColor(gradientOklab, intensity, timeOffset)));
      } else {
        ({ r, g, b } = colorRgb);
      }
      const baseA = (0.08 + intensity * 0.92) * 255;

      const start = pixelMaskStarts[dotIdx]!;
      const len = pixelMaskLengths[dotIdx]!;
      for (let k = 0; k < len; k++) {
        const px = pixelMaskIndices[start + k]!;
        const coverage = pixelMaskCoverages[start + k]!;
        data[px] = r;
        data[px + 1] = g;
        data[px + 2] = b;
        data[px + 3] = Math.round(baseA * coverage);
      }
    }

    ctx.putImageData(frameImageData, 0, 0);
  }

  function completeMorphNow() {
    engine.completeMorph();
    morphResolve?.();
    morphResolve = null;
    morphReject = null;
    morphProgress = 0;
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
        completeMorphNow();
        calculateBoundaries(engine.getSarmalSkeleton());
      }
      computeSkeletonGrid(engine.getSarmalSkeleton());
    } else if (engine.isLiveSkeleton) {
      calculateBoundaries(engine.getSarmalSkeleton());
      computeSkeletonGrid(engine.getSarmalSkeleton());
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

  validateBaseRenderOptions({ trailColor: initialColor, skeletonColor: skeletonColorOpt });
  applyColor(initialColor);
  applySkeletonColor(skeletonColorOpt);
  calculateBoundaries(engine.getSarmalSkeleton());
  computePixelMask();
  computeSkeletonGrid(engine.getSarmalSkeleton());
  frameImageData = new ImageData(W, H);
  buildBgImageData();

  if (initialPhase !== undefined) {
    engine.seek(initialPhase);
  }

  renderFrame(0);

  // ── Instance ─────────────────────────────────────────────────────────────────

  const instance: SarmalInstance<DotMatrixRuntimeRenderOptions> = {
    /** Starts the animation loop. Does nothing if already running. */
    play() {
      if (animationId !== null) {
        return;
      }

      lastTime = performance.now();
      loop();
    },

    /** Pauses the animation loop. Preserves current trail state. */
    pause() {
      if (animationId === null) {
        return;
      }

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
        completeMorphNow();
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
     * Supported: `trailColor`, `trailStyle`, and `skeletonColor`.
     * ! Unsupported fields (`headColor`, `headRadius`, `trailWidth`) throw.
     * ! Validation fails the entire call if any field is invalid, leaving options unchanged.
     */
    setRenderOptions(partial: DotMatrixRuntimeRenderOptions): void {
      validateBaseRenderOptions(partial);

      let needsRebuildBg = false;

      if (partial.trailColor !== undefined) {
        applyColor(partial.trailColor);
        needsRebuildBg = true;
      }

      if (partial.skeletonColor !== undefined) {
        applySkeletonColor(partial.skeletonColor);
      }

      if (partial.trailStyle !== undefined) {
        currentTrailStyle = partial.trailStyle;
        if (currentTrailStyle === "default") {
          animTime = 0;
        }
      }

      if (needsRebuildBg) {
        buildBgImageData();
      }

      if (currentTrailStyle !== "default" && gradientOklab === null) {
        // biome-ignore lint/suspicious/noConsole: advisory for developer feedback
        console.warn(
          `[sarmal] dot matrix: trailColor is a single color but trailStyle is "${currentTrailStyle}"; the trail will render as a solid color. Pass an array of hex colors to use a real gradient.`,
        );
      } else if (currentTrailStyle === "default" && gradientOklab !== null) {
        // biome-ignore lint/suspicious/noConsole: advisory for developer feedback
        console.warn(
          '[sarmal] dot matrix: trailColor is an array but trailStyle is "default"; only the first color will be used. Pass a gradient trailStyle to use the whole palette.',
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
