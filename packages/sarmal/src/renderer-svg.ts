import type {
  BaseRendererOptions,
  CurveDef,
  Engine,
  MorphOptions,
  Point,
  RuntimeRenderOptions,
  SarmalInstance,
  TrailColor,
  TrailStyle,
} from "./types";

import {
  DEFAULT_MORPH_DURATION_MS,
  DEFAULT_SKELETON_OPACITY,
  computeBoundaries,
  computeTrailQuad,
  enginePassthroughs,
  getPaletteColor,
  resolveHeadColor,
  resolveTrailPalette,
  resolveTrailMainColor,
  validateRenderOptions,
  warnIfTrailColorMismatch,
} from "./renderer-shared";
import { createEngine } from "./engine";

export interface SVGRendererOptions extends BaseRendererOptions {
  /** SVG element the renderer draws into directly */
  container: SVGSVGElement;
  engine: Engine;
  /** @default 'Loading' */
  ariaLabel?: string;
}

export interface SVGSarmalOptions extends Omit<SVGRendererOptions, "container" | "engine"> {
  /** @default 120 */
  trailLength?: number;
}
const EMPTY_PARAMS: Record<string, number> = {};

/**
 * Threshold above which a console.warn suggests canvas for long SVG trails
 * The value is based on results from `playwright test e2e/tests/svg-trail-benchmark.spec.ts --project=chromium-dpr1 --reporter=list`
 */
const HIGH_TRAIL_LENGTH_THRESHOLD = 5000;

function pointsToPathString(pts: Point[], scale: number, offsetX: number, offsetY: number): string {
  if (pts.length < 2) {
    return "";
  }

  const px = (p: Point) => (p.x * scale + offsetX).toFixed(2);
  const py = (p: Point) => (p.y * scale + offsetY).toFixed(2);
  let d = `M${px(pts[0]!)} ${py(pts[0]!)}`;

  for (let i = 1; i < pts.length; i++) {
    d += ` L${px(pts[i]!)} ${py(pts[i]!)}`;
  }

  return d + " Z";
}

function sampleCurveSkeleton(curveDef: CurveDef): Point[] {
  const period = curveDef.period ?? Math.PI * 2;
  const samples = Math.ceil(period * 50); // match engine's POINTS_PER_PERIOD_UNIT
  const pts: Point[] = Array.from({ length: samples });

  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * period;
    pts[i] = curveDef.skeletonFn ? curveDef.skeletonFn(t) : curveDef.fn(t, 0, EMPTY_PARAMS);
  }

  return pts;
}

function el(tag: string): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

/**
 * Creates a live SVG renderer for sarmal animations
 * The SVG is appended into `container` and updated each frame via **requestAnimationFrame**
 */
export function createSVGRenderer(options: SVGRendererOptions): SarmalInstance {
  const { container, engine } = options;
  const poolSize = engine.trailLength;

  if (poolSize > HIGH_TRAIL_LENGTH_THRESHOLD) {
    console.warn(
      `[sarmal] High trailLength in SVG renderer (${poolSize}). Consider using the canvas renderer for long trails.`,
    );
  }

  // TODO: duplicate let variables. maybe a better way to share these too?
  // ! Mutated only by `setRenderOptions`.
  let trailStyle: TrailStyle = options.trailStyle ?? "default";
  let trailColor: TrailColor = options.trailColor ?? "#ffffff";
  let skeletonColor: string = options.skeletonColor ?? "#ffffff";
  // `null` means that head color is derived from `trailColor` & `trailStyle` and refreshed whenever either changes.
  let userHeadColor: string | null = options.headColor ?? null;
  let headColor: string = userHeadColor ?? resolveHeadColor(trailColor, trailStyle);

  let trailSolid: string = resolveTrailMainColor(trailColor);
  let trailPalette: string[] = resolveTrailPalette(trailColor);

  const ariaLabel = options.ariaLabel ?? "Loading";

  warnIfTrailColorMismatch(trailColor, trailStyle);

  const viewSize = 100;
  const headRadius = options.headRadius ?? 1.5;
  // Trail widths are in viewBox units (0–100 space),
  // so they need to be ~half the pixel-space defaults used by the canvas renderer
  const svgTrailMinWidth = 0.25;
  const svgTrailMaxWidth = 1.25;
  const svgSkeletonStrokeWidth = "0.75";

  container.setAttribute("viewBox", `0 0 ${viewSize} ${viewSize}`);
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", ariaLabel);

  const group = el("g") as SVGGElement;

  const titleEl = el("title");
  titleEl.textContent = ariaLabel;
  group.appendChild(titleEl);

  const skeletonPath = el("path") as SVGPathElement;
  skeletonPath.setAttribute("data-sarmal-role", "skeleton");
  skeletonPath.setAttribute("fill", "none");
  skeletonPath.setAttribute("stroke", skeletonColor);
  skeletonPath.setAttribute("stroke-opacity", String(DEFAULT_SKELETON_OPACITY));
  skeletonPath.setAttribute("stroke-width", svgSkeletonStrokeWidth);
  if (skeletonColor === "transparent") {
    skeletonPath.setAttribute("visibility", "hidden");
  }
  group.appendChild(skeletonPath);

  const skeletonPathA = el("path") as SVGPathElement;
  skeletonPathA.setAttribute("fill", "none");
  skeletonPathA.setAttribute("stroke", skeletonColor);
  skeletonPathA.setAttribute("stroke-width", svgSkeletonStrokeWidth);
  skeletonPathA.setAttribute("visibility", "hidden");
  group.appendChild(skeletonPathA);

  const skeletonPathB = el("path") as SVGPathElement;
  skeletonPathB.setAttribute("fill", "none");
  skeletonPathB.setAttribute("stroke", skeletonColor);
  skeletonPathB.setAttribute("stroke-width", svgSkeletonStrokeWidth);
  skeletonPathB.setAttribute("visibility", "hidden");
  group.appendChild(skeletonPathB);

  let morphPathABuilt = "";
  let morphPathBBuilt = "";

  const trailPaths: SVGPathElement[] = [];
  for (let i = 0; i < poolSize; i++) {
    const path = el("path") as SVGPathElement;
    path.setAttribute("fill", trailSolid);
    group.appendChild(path);
    trailPaths.push(path);
  }

  const headCircle = el("circle") as SVGCircleElement;
  headCircle.setAttribute("data-sarmal-role", "head");
  headCircle.setAttribute("fill", headColor);
  headCircle.setAttribute("r", String(headRadius));
  group.appendChild(headCircle);

  container.appendChild(group);

  let gradientAnimTime = 0;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function applyBoundaries(skeleton: Point[]) {
    const b = computeBoundaries(skeleton, viewSize, viewSize);
    if (b) {
      scale = b.scale;
      offsetX = b.offsetX;
      offsetY = b.offsetY;
    }
  }

  // Coordinate transform helpers: numeric (for math)
  function px(p: Point): number {
    return p.x * scale + offsetX;
  }
  function py(p: Point): number {
    return p.y * scale + offsetY;
  }

  function updateSkeleton(skeleton: Point[]) {
    skeletonPath.setAttribute("d", pointsToPathString(skeleton, scale, offsetX, offsetY));
  }

  const skeleton = engine.getSarmalSkeleton();
  applyBoundaries(skeleton);

  if (!engine.isLiveSkeleton) {
    updateSkeleton(skeleton);
  }

  function updateTrail(trail: Point[], trailCount: number) {
    if (trailCount < 2) {
      for (const p of trailPaths) {
        p.setAttribute("d", "");
      }

      return;
    }

    /**
     * Ribbon approach: each segment is a filled quad with its own opacity.
     * Quads are drawn from tail to head, with later quads overlaying earlier ones.
     */
    const drawnCount = trailCount - 1;

    for (let i = 0; i < drawnCount; i++) {
      const { l0x, l0y, r0x, r0y, l1x, l1y, r1x, r1y, opacity, progress } = computeTrailQuad(
        trail,
        i,
        trailCount,
        px,
        py,
        svgTrailMinWidth,
        svgTrailMaxWidth,
      );

      const d = `M${l0x.toFixed(2)} ${l0y.toFixed(2)} L${l1x.toFixed(2)} ${l1y.toFixed(2)} L${r1x.toFixed(2)} ${r1y.toFixed(2)} L${r0x.toFixed(2)} ${r0y.toFixed(2)} Z`;

      trailPaths[i]!.setAttribute("d", d);
      trailPaths[i]!.setAttribute("fill-opacity", opacity.toFixed(3));

      if (trailStyle !== "default") {
        const timeOffset = trailStyle === "gradient-animated" ? gradientAnimTime * 0.0005 : 0;
        const { r, g, b } = getPaletteColor(trailPalette, progress, timeOffset);
        trailPaths[i]!.setAttribute("fill", `rgb(${r},${g},${b})`);
      }
    }

    // Hide unused paths
    for (let i = drawnCount; i < trailPaths.length; i++) {
      trailPaths[i]!.setAttribute("d", "");
    }
  }

  function updateHead(trail: Point[], trailCount: number) {
    if (trailCount === 0) {
      return;
    }

    const head = trail[trailCount - 1]!;
    const x = px(head);
    const y = py(head);

    headCircle.setAttribute("cx", String(x));
    headCircle.setAttribute("cy", String(y));
  }

  let animationId: number | null = null;
  let lastTime = 0;
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let morphResolve: (() => void) | null = null;
  let morphReject: ((error: Error) => void) | null = null;
  let morphDurationMs = DEFAULT_MORPH_DURATION_MS;
  let morphTarget: CurveDef | null = null;
  let morphAlpha = 0;

  function renderFrame(deltaTime: number) {
    if (trailStyle === "gradient-animated") {
      gradientAnimTime += deltaTime * 1000;
    }

    if (engine.morphAlpha !== null) {
      morphAlpha = Math.min(1, morphAlpha + deltaTime / (morphDurationMs / 1000));
      engine.setMorphAlpha(morphAlpha);

      if (morphPathABuilt) {
        skeletonPathA.setAttribute("d", morphPathABuilt);
        skeletonPathA.setAttribute("visibility", "visible");
        skeletonPathA.setAttribute(
          "stroke-opacity",
          String((1 - morphAlpha) * DEFAULT_SKELETON_OPACITY),
        );
      }

      if (morphPathBBuilt) {
        skeletonPathB.setAttribute("d", morphPathBBuilt);
        skeletonPathB.setAttribute("visibility", "visible");
        skeletonPathB.setAttribute("stroke-opacity", String(morphAlpha * DEFAULT_SKELETON_OPACITY));
      }

      if (morphAlpha >= 1) {
        engine.completeMorph();
        morphResolve?.();
        morphResolve = null;
        morphReject = null;
        morphTarget = null;
        morphAlpha = 0;
        morphPathABuilt = "";
        morphPathBBuilt = "";
        skeletonPathA.setAttribute("visibility", "hidden");
        skeletonPathB.setAttribute("visibility", "hidden");
        // Snap coordinate space to `curveB` and update skeleton path
        const newSkeleton = engine.getSarmalSkeleton();
        applyBoundaries(newSkeleton);
        updateSkeleton(newSkeleton);
      }
    }

    const trail = engine.tick(deltaTime);
    const trailCount = engine.trailCount;

    if (engine.isLiveSkeleton && engine.morphAlpha === null) {
      const liveSkeleton = engine.getSarmalSkeleton();
      applyBoundaries(liveSkeleton);
      updateSkeleton(liveSkeleton);
    }

    updateTrail(trail, trailCount);
    updateHead(trail, trailCount);
  }

  function loop() {
    const now = performance.now();
    const deltaTime = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    renderFrame(deltaTime);

    if (!prefersReducedMotion) {
      animationId = requestAnimationFrame(loop);
    }
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
    },

    destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      if (morphReject !== null) {
        morphReject(new Error("Instance destroyed during morph"));
        morphResolve = null;
        morphReject = null;
      }

      group.remove();
    },

    ...enginePassthroughs(engine),

    morphTo(target: CurveDef, options?: MorphOptions): Promise<void> {
      if (morphResolve !== null) {
        engine.completeMorph();
        morphResolve();
        morphResolve = null;
        morphReject = null;
        morphAlpha = 0;
        skeletonPathA.setAttribute("visibility", "hidden");
        skeletonPathB.setAttribute("visibility", "hidden");
      }

      morphDurationMs = options?.duration ?? DEFAULT_MORPH_DURATION_MS;
      morphTarget = target;
      morphAlpha = 0;

      const currentSkeleton = engine.getSarmalSkeleton();
      morphPathABuilt = pointsToPathString(currentSkeleton, scale, offsetX, offsetY);

      engine.startMorph(target, options?.morphStrategy);

      if (morphTarget) {
        const targetSkeleton = sampleCurveSkeleton(target);
        morphPathBBuilt = pointsToPathString(targetSkeleton, scale, offsetX, offsetY);
      }

      return new Promise<void>((resolve, reject) => {
        morphResolve = resolve;
        morphReject = reject;
      });
    },

    setRenderOptions(partial: RuntimeRenderOptions): void {
      validateRenderOptions(partial);

      const prevTrailStyle = trailStyle;

      if (partial.trailColor !== undefined) {
        trailColor = partial.trailColor;
        trailSolid = resolveTrailMainColor(trailColor);
        trailPalette = resolveTrailPalette(trailColor);

        // Only the "default" style paints trail paths at setter time, whereas gradient styles repaint per-segment fills every frame in `updateTrail`,
        //  so they would already overwrite any fill operation made here
        if (trailStyle === "default") {
          for (const p of trailPaths) {
            p.setAttribute("fill", trailSolid);
          }
        }
      }

      if (partial.skeletonColor !== undefined) {
        skeletonColor = partial.skeletonColor;

        if (skeletonColor === "transparent") {
          // TODO: what happens when `skeletonColor` is set to "transparent" during morph? Do the skeleton paths of A and B still render?
          skeletonPath.setAttribute("visibility", "hidden");
        } else {
          skeletonPath.setAttribute("stroke", skeletonColor);
          skeletonPath.removeAttribute("visibility");
          skeletonPathA.setAttribute("stroke", skeletonColor);
          skeletonPathB.setAttribute("stroke", skeletonColor);
        }
      }

      if (partial.trailStyle !== undefined) {
        trailStyle = partial.trailStyle;

        // When transitioning from gradient to default, the whole trail needs to be filled with the color
        // Transitioning from default to gradient does not require this as it already does per-segment color fills
        if (prevTrailStyle !== "default" && trailStyle === "default") {
          for (const p of trailPaths) {
            p.setAttribute("fill", trailSolid);
          }
        }
      }
      if (partial.headColor !== undefined) {
        userHeadColor = partial.headColor;
      }

      if (userHeadColor === null) {
        headColor = resolveHeadColor(trailColor, trailStyle);
      } else {
        headColor = userHeadColor;
      }
      headCircle.setAttribute("fill", headColor);

      if (partial.trailColor !== undefined || partial.trailStyle !== undefined) {
        warnIfTrailColorMismatch(trailColor, trailStyle);
      }
    },
  };

  if (shouldAutoStart) {
    instance.play();
  }

  return instance;
}

/**
 * Creates a sarmal animation directly inside an `<svg>` element using an SVG renderer.
 * The passed `<svg>` element is set to `viewBox="0 0 100 100"` and animated via requestAnimationFrame
 *
 * @example
 * ```ts
 * import { createSarmalSVG, epitrochoid7 } from '@sarmal/core'
 *
 * // <svg id="spinner"></svg> in your HTML
 * const svg = document.getElementById('spinner')
 * const sarmal = createSarmalSVG(svg, epitrochoid7)
 *
 * // To control manually, use autoStart: false
 * const controlled = createSarmalSVG(svg, rose5, { autoStart: false })
 * controlled.play()  // Start when ready
 * controlled.pause() // Pause later
 * ```
 */
export function createSarmalSVG(
  container: SVGSVGElement,
  curveDef: CurveDef,
  options?: SVGSarmalOptions,
): SarmalInstance {
  const { trailLength, ...rendererOpts } = options ?? {};
  const engine = createEngine(curveDef, trailLength);
  return createSVGRenderer({ container, engine, ...rendererOpts });
}
