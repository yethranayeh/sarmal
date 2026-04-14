import type { CurveDef, Engine, MorphOptions, Point, SarmalInstance } from "./types";
import {
  DEFAULT_MORPH_DURATION_MS,
  DEFAULT_SKELETON_OPACITY,
  computeBoundaries,
  computeTrailQuad,
} from "./renderer-shared";
import { createEngine } from "./engine";

export interface SVGRendererOptions {
  /** Container element that will contain the SVG */
  container: Element;
  engine: Engine;
  /** @default '#ffffff' */
  skeletonColor?: string;
  /** @default '#ffffff' */
  trailColor?: string;
  /** @default '#ffffff' */
  headColor?: string;
  /** @default 4 */
  headRadius?: number;
  /** @default 'Loading' */
  ariaLabel?: string;
}

export interface SVGSarmalOptions extends Omit<SVGRendererOptions, "container" | "engine"> {
  /** @default 120 */
  trailLength?: number;
}
/** Maximum number of trail segment paths pre-created for the ribbon */
const MAX_TRAIL_SEGMENTS = 200;

const EMPTY_PARAMS: Record<string, number> = {};

function pointsToPathString(pts: Point[], scale: number, offsetX: number, offsetY: number): string {
  if (pts.length < 2) return "";
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
  const trailColor = options.trailColor ?? "#ffffff";
  const opts = {
    skeletonColor: options.skeletonColor ?? "#ffffff",
    trailColor,
    headColor: options.headColor ?? trailColor,
    ariaLabel: options.ariaLabel ?? "Loading",
  };

  const rect = container.getBoundingClientRect();
  const width = rect.width || 200;
  const height = rect.height || 200;
  const headRadius =
    options.headRadius ?? Math.max(2, 3 * Math.sqrt(Math.min(width, height) / 160));

  const svg = el("svg") as SVGSVGElement;
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", opts.ariaLabel);

  const titleEl = el("title");
  titleEl.textContent = opts.ariaLabel;
  svg.appendChild(titleEl);

  const skeletonPath = el("path") as SVGPathElement;
  skeletonPath.setAttribute("fill", "none");
  skeletonPath.setAttribute("stroke", opts.skeletonColor);
  skeletonPath.setAttribute("stroke-opacity", String(DEFAULT_SKELETON_OPACITY));
  skeletonPath.setAttribute("stroke-width", "1.5");
  svg.appendChild(skeletonPath);

  const skeletonPathA = el("path") as SVGPathElement;
  skeletonPathA.setAttribute("fill", "none");
  skeletonPathA.setAttribute("stroke", opts.skeletonColor);
  skeletonPathA.setAttribute("stroke-width", "1.5");
  skeletonPathA.setAttribute("visibility", "hidden");
  svg.appendChild(skeletonPathA);

  const skeletonPathB = el("path") as SVGPathElement;
  skeletonPathB.setAttribute("fill", "none");
  skeletonPathB.setAttribute("stroke", opts.skeletonColor);
  skeletonPathB.setAttribute("stroke-width", "1.5");
  skeletonPathB.setAttribute("visibility", "hidden");
  svg.appendChild(skeletonPathB);

  let morphPathABuilt = "";
  let morphPathBBuilt = "";

  const trailPaths: SVGPathElement[] = [];
  for (let i = 0; i < MAX_TRAIL_SEGMENTS; i++) {
    const path = el("path") as SVGPathElement;
    path.setAttribute("fill", opts.trailColor);
    svg.appendChild(path);
    trailPaths.push(path);
  }

  const headCircle = el("circle") as SVGCircleElement;
  headCircle.setAttribute("fill", opts.headColor);
  headCircle.setAttribute("r", String(headRadius));
  svg.appendChild(headCircle);

  container.appendChild(svg);

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function applyBoundaries(skeleton: Point[]) {
    const b = computeBoundaries(skeleton, width, height);
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
    for (let i = 0; i < trailCount - 1; i++) {
      const { l0x, l0y, r0x, r0y, l1x, l1y, r1x, r1y, opacity } = computeTrailQuad(
        trail,
        i,
        trailCount,
        px,
        py,
      );

      const d = `M${l0x.toFixed(2)} ${l0y.toFixed(2)} L${l1x.toFixed(2)} ${l1y.toFixed(2)} L${r1x.toFixed(2)} ${r1y.toFixed(2)} L${r0x.toFixed(2)} ${r0y.toFixed(2)} Z`;

      trailPaths[i]!.setAttribute("d", d);
      trailPaths[i]!.setAttribute("fill-opacity", opacity.toFixed(3));
    }

    // Hide unused paths
    for (let i = trailCount - 1; i < trailPaths.length; i++) {
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
  let morphDurationMs = DEFAULT_MORPH_DURATION_MS;
  let morphTarget: CurveDef | null = null;
  let morphAlpha = 0;

  function renderFrame() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    if (engine.morphAlpha !== null) {
      morphAlpha = Math.min(1, morphAlpha + dt / (morphDurationMs / 1000));
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

    const trail = engine.tick(dt);
    const trailCount = engine.trailCount;

    if (engine.isLiveSkeleton && engine.morphAlpha === null) {
      const liveSkeleton = engine.getSarmalSkeleton();
      applyBoundaries(liveSkeleton);
      updateSkeleton(liveSkeleton);
    }

    updateTrail(trail, trailCount);
    updateHead(trail, trailCount);

    if (!prefersReducedMotion) {
      animationId = requestAnimationFrame(renderFrame);
    }
  }

  return {
    start() {
      if (animationId !== null) {
        return;
      }
      lastTime = performance.now();
      renderFrame();
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
    },

    destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      svg.remove();
    },

    jump(t, options) {
      engine.jump(t, options);
    },

    seek(t, options) {
      engine.seek(t, options);
    },

    morphTo(target: CurveDef, options?: MorphOptions): Promise<void> {
      if (morphResolve !== null) {
        engine.completeMorph();
        morphResolve();
        morphResolve = null;
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

      return new Promise<void>((resolve) => {
        morphResolve = resolve;
      });
    },
  };
}

/**
 * Creates a sarmal animation inside a container element using an SVG renderer
 * The SVG is appended to the container and animated via requestAnimationFrame
 *
 * @example
 * ```ts
 * import { createSarmalSVG, curves } from '@sarmal/core'
 * const sarmal = createSarmalSVG(document.getElementById('spinner'), curves.epitrochoid7)
 * sarmal.start()
 * ```
 */
export function createSarmalSVG(
  container: Element,
  curveDef: CurveDef,
  options?: SVGSarmalOptions,
): SarmalInstance {
  const { trailLength, ...rendererOpts } = options ?? {};
  const engine = createEngine(curveDef, trailLength);
  return createSVGRenderer({ container, engine, ...rendererOpts });
}
