import type { CurveDef, Engine, MorphOptions, Point, SarmalInstance } from "./types";
import { computeNormal } from "./renderer";
import { createEngine } from "./engine";

const DEFAULT_MORPH_DURATION_MS = 300;

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
/** Higher values = sharper fade near the tail */
const TRAIL_FADE_CURVE = 1.5;
const TRAIL_MAX_OPACITY = 0.88;
/** Stroke width at the tail */
const TRAIL_MIN_WIDTH = 0.5;
/** Stroke width at the head */
const TRAIL_MAX_WIDTH = 2.5;
const DEFAULT_SKELETON_OPACITY = 0.15;
/** Fraction of the bounding box added as padding when auto-fitting the curve */
const FIT_PADDING = 0.1;

const EMPTY_PARAMS: Record<string, number> = {};

function el(tag: string): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

/**
 * Creates a live SVG renderer for sarmal animations
 * The SVG is appended into `container` and updated each frame via **requestAnimationFrame**
 */
export function createSVGRenderer(options: SVGRendererOptions): SarmalInstance {
  const { container, engine } = options;
  const opts = {
    skeletonColor: options.skeletonColor ?? "#ffffff",
    trailColor: options.trailColor ?? "#ffffff",
    headColor: options.headColor ?? "#ffffff",
    headRadius: options.headRadius ?? 4,
    ariaLabel: options.ariaLabel ?? "Loading",
  };

  const rect = container.getBoundingClientRect();
  const width = rect.width || 200;
  const height = rect.height || 200;

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
  headCircle.setAttribute("r", String(opts.headRadius));
  svg.appendChild(headCircle);

  container.appendChild(svg);

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function calculateBoundaries(skeleton: Point[]) {
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

    const w = maxX - minX;
    const h = maxY - minY;

    if (w === 0 && h === 0) {
      throw new Error(
        "[sarmal] All skeleton points are identical. Check that your curve fn returns distinct points for different values of t.",
      );
    }

    const scaleX = width / (w * (1 + FIT_PADDING * 2));
    const scaleY = height / (h * (1 + FIT_PADDING * 2));

    scale = Math.min(scaleX, scaleY);
    offsetX = (width - w * scale) / 2 - minX * scale;
    offsetY = (height - h * scale) / 2 - minY * scale;
  }

  // Coordinate transform helpers: numeric (for math) and string (for path strings)
  function px(p: Point): number {
    return p.x * scale + offsetX;
  }
  function py(p: Point): number {
    return p.y * scale + offsetY;
  }
  function pxStr(p: Point): string {
    return px(p).toFixed(2);
  }
  function pyStr(p: Point): string {
    return py(p).toFixed(2);
  }

  function updateSkeleton(skeleton: Point[]) {
    if (skeleton.length < 2) {
      skeletonPath.setAttribute("d", "");
      return;
    }

    let d = `M${pxStr(skeleton[0]!)} ${pyStr(skeleton[0]!)}`;

    for (let i = 1; i < skeleton.length; i++) {
      d += ` L${pxStr(skeleton[i]!)} ${pyStr(skeleton[i]!)}`;
    }
    d += " Z";

    skeletonPath.setAttribute("d", d);
  }

  const skeleton = engine.getSarmalSkeleton();
  calculateBoundaries(skeleton);

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
      const progress = i / (trailCount - 1);
      const nextProgress = (i + 1) / (trailCount - 1);
      const opacity = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
      const width = TRAIL_MIN_WIDTH + progress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);
      const nextWidth = TRAIL_MIN_WIDTH + nextProgress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);

      const curr = trail[i]!;
      const next = trail[i + 1]!;
      const n0 = computeNormal(trail, i);
      const n1 = computeNormal(trail, i + 1);

      const halfW0 = width / 2;
      const halfW1 = nextWidth / 2;

      // Four corners of the quad: left0, left1, right1, right0
      const l0x = px(curr) + n0.x * halfW0;
      const l0y = py(curr) + n0.y * halfW0;
      const r0x = px(curr) - n0.x * halfW0;
      const r0y = py(curr) - n0.y * halfW0;
      const l1x = px(next) + n1.x * halfW1;
      const l1y = py(next) + n1.y * halfW1;
      const r1x = px(next) - n1.x * halfW1;
      const r1y = py(next) - n1.y * halfW1;

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

  function buildSkeletonPath(
    target: CurveDef,
    scale: number,
    offsetX: number,
    offsetY: number,
  ): string {
    const period = target.period ?? Math.PI * 2;
    const samples = Math.max(50, Math.round(period * 20));
    const points: Point[] = [];

    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * period;
      const p = target.fn(t, 0, EMPTY_PARAMS);
      points.push(p);
    }

    if (points.length < 2) {
      return "";
    }

    const px = (p: Point) => (p.x * scale + offsetX).toFixed(2);
    const py = (p: Point) => (p.y * scale + offsetY).toFixed(2);
    let d = `M${px(points[0]!)} ${py(points[0]!)}`;

    for (let i = 1; i < points.length; i++) {
      d += ` L${px(points[i]!)} ${py(points[i]!)}`;
    }
    d += " Z";

    return d;
  }

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
        calculateBoundaries(newSkeleton);
        updateSkeleton(newSkeleton);
      }
    }

    const trail = engine.tick(dt);
    const trailCount = engine.trailCount;

    if (engine.isLiveSkeleton && engine.morphAlpha === null) {
      const liveSkeleton = engine.getSarmalSkeleton();
      calculateBoundaries(liveSkeleton);
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
        skeletonPathA.setAttribute("visibility", "hidden");
        skeletonPathB.setAttribute("visibility", "hidden");
      }

      morphDurationMs = options?.duration ?? DEFAULT_MORPH_DURATION_MS;
      morphTarget = target;
      morphAlpha = 0;

      const currentSkeleton = engine.getSarmalSkeleton();
      if (currentSkeleton.length >= 2) {
        const px = (p: Point) => (p.x * scale + offsetX).toFixed(2);
        const py = (p: Point) => (p.y * scale + offsetY).toFixed(2);
        morphPathABuilt = `M${px(currentSkeleton[0]!)} ${py(currentSkeleton[0]!)}`;
        for (let i = 1; i < currentSkeleton.length; i++) {
          morphPathABuilt += ` L${px(currentSkeleton[i]!)} ${py(currentSkeleton[i]!)}`;
        }
        morphPathABuilt += " Z";
      } else {
        morphPathABuilt = "";
      }

      engine.startMorph(target, options?.morphStrategy);

      if (morphTarget) {
        morphPathBBuilt = buildSkeletonPath(morphTarget, scale, offsetX, offsetY);
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
