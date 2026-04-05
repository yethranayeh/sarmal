import type { CurveDef, Engine, Point, SarmalInstance } from "./types";
import { createEngine } from "./engine";

const TRAIL_BATCH_COUNT = 12;
/** Higher values = sharper fade near the tail */
const TRAIL_FADE_CURVE = 1.5;
const TRAIL_MAX_OPACITY = 0.88;
/** Stroke width at the tail */
const TRAIL_MIN_WIDTH = 0.5;
/** Stroke width at the head */
const TRAIL_MAX_WIDTH = 2.5;
const DEFAULT_SKELETON_OPACITY = 0.15;
const DEFAULT_GLOW_INNER_STOP = 0.4;
const DEFAULT_GLOW_FALLOFF_OPACITY = 0.53;
/** Fraction of the bounding box added as padding when auto-fitting the curve */
const FIT_PADDING = 0.1;

let instanceCount = 0;

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
  /** @default 20 */
  glowSize?: number;
  /** @default 'Loading' */
  ariaLabel?: string;
}

export interface SVGSarmalOptions extends Omit<SVGRendererOptions, "container" | "engine"> {
  /** @default 120 */
  trailLength?: number;
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
  const opts = {
    skeletonColor: options.skeletonColor ?? "#ffffff",
    trailColor: options.trailColor ?? "#ffffff",
    headColor: options.headColor ?? "#ffffff",
    headRadius: options.headRadius ?? 4,
    glowSize: options.glowSize ?? 20,
    ariaLabel: options.ariaLabel ?? "Loading",
  };

  // Unique per-instance ID prevents ID collisions of multiple instances
  const uid = ++instanceCount;
  const gradientId = `sarmal-glow-${uid}`;

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

  const defs = el("defs");
  const gradient = el("radialGradient") as SVGRadialGradientElement;
  gradient.id = gradientId;
  gradient.setAttribute("cx", "50%");
  gradient.setAttribute("cy", "50%");
  gradient.setAttribute("r", "50%");
  const stop0 = el("stop");
  stop0.setAttribute("offset", "0%");
  stop0.setAttribute("stop-color", opts.headColor);
  stop0.setAttribute("stop-opacity", "1");
  const stopMid = el("stop");
  stopMid.setAttribute("offset", `${DEFAULT_GLOW_INNER_STOP * 100}%`);
  stopMid.setAttribute("stop-color", opts.headColor);
  stopMid.setAttribute("stop-opacity", String(DEFAULT_GLOW_FALLOFF_OPACITY));
  const stop1 = el("stop");
  stop1.setAttribute("offset", "100%");
  stop1.setAttribute("stop-color", opts.headColor);
  stop1.setAttribute("stop-opacity", "0");
  gradient.append(stop0, stopMid, stop1);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  const skeletonPath = el("path") as SVGPathElement;
  skeletonPath.setAttribute("fill", "none");
  skeletonPath.setAttribute("stroke", opts.skeletonColor);
  skeletonPath.setAttribute("stroke-opacity", String(DEFAULT_SKELETON_OPACITY));
  skeletonPath.setAttribute("stroke-width", "1.5");
  svg.appendChild(skeletonPath);

  const trailPaths: SVGPathElement[] = [];
  for (let i = 0; i < TRAIL_BATCH_COUNT; i++) {
    const path = el("path") as SVGPathElement;
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", opts.trailColor);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    trailPaths.push(path);
  }

  const glowCircle = el("circle") as SVGCircleElement;
  glowCircle.setAttribute("fill", `url(#${gradientId})`);
  glowCircle.setAttribute("r", String(opts.glowSize));
  svg.appendChild(glowCircle);

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
    const scaleX = width / (w * (1 + FIT_PADDING * 2));
    const scaleY = height / (h * (1 + FIT_PADDING * 2));

    scale = Math.min(scaleX, scaleY);
    offsetX = (width - w * scale) / 2 - minX * scale;
    offsetY = (height - h * scale) / 2 - minY * scale;
  }

  // TODO: might avoid code repetition
  function px(p: Point) {
    return (p.x * scale + offsetX).toFixed(2);
  }
  function py(p: Point) {
    return (p.y * scale + offsetY).toFixed(2);
  }

  const skeleton = engine.getSarmalSkeleton();
  calculateBoundaries(skeleton);

  if (skeleton.length >= 2) {
    let d = `M${px(skeleton[0]!)} ${py(skeleton[0]!)}`;

    for (let i = 1; i < skeleton.length; i++) {
      d += ` L${px(skeleton[i]!)} ${py(skeleton[i]!)}`;
    }
    d += " Z";

    skeletonPath.setAttribute("d", d);
  }

  function updateTrail(trail: Point[], trailCount: number) {
    if (trailCount < 2) {
      for (const p of trailPaths) {
        p.setAttribute("d", "");
      }

      return;
    }
    const batchSize = Math.ceil(trailCount / TRAIL_BATCH_COUNT);

    for (let b = 0; b < TRAIL_BATCH_COUNT; b++) {
      const start = b * batchSize;
      const end = Math.min(start + batchSize, trailCount - 1);
      if (start >= trailCount - 1) {
        trailPaths[b]!.setAttribute("d", "");
        continue;
      }
      const progress = (start + end) / 2 / (trailCount - 1);
      const opacity = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
      const strokeWidth = TRAIL_MIN_WIDTH + progress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);

      let d = `M${px(trail[start]!)} ${py(trail[start]!)}`;
      for (let i = start + 1; i <= end; i++) {
        d += ` L${px(trail[i]!)} ${py(trail[i]!)}`;
      }

      trailPaths[b]!.setAttribute("d", d);
      trailPaths[b]!.setAttribute("stroke-opacity", opacity.toFixed(3));
      trailPaths[b]!.setAttribute("stroke-width", strokeWidth.toFixed(2));
    }
  }

  function updateHead(trail: Point[], trailCount: number) {
    if (trailCount === 0) {
      return;
    }

    const head = trail[trailCount - 1]!;
    const x = px(head);
    const y = py(head);

    glowCircle.setAttribute("cx", x);
    glowCircle.setAttribute("cy", y);
    headCircle.setAttribute("cx", x);
    headCircle.setAttribute("cy", y);
  }

  let animationId: number | null = null;
  let lastTime = 0;
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function renderFrame() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    const trail = engine.tick(dt);
    const trailCount = engine.trailCount;

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
