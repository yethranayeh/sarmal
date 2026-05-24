import type { TrailColor, TrailStyle } from "./types";
import type { CurveName } from "./curves";

import { createSarmal, createSarmalSVG, createSarmalDotMatrix } from "./index";
import { curves } from "./curves";

/**
 * Parses the `data-trail-color` attribute, which accepts either a single color string
 *  or a JSON array of color strings.
 *
 * Anything that does not parse as a JSON array is passed through as a string,
 *  so the library's own validator produces a meaningful error.
 *
 * Accepts the same formats as `trailColor`: `#rrggbb`, `#rgb`, `rgb()`, `rgba()`, `oklch()`.
 *
 * @example "#ff0000"
 * @example '["#ff0000","#00ff00"]'
 * @example "oklch(0.7 0.15 200)"
 */
function parseTrailColor(value: string): TrailColor {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed as string[];
    }
  } catch {
    // Will delegate further validation to renderer. Will treat it as a single color string here.
  }
  return value;
}

/**
 * Parses a boolean data attribute.
 * Returns `false` only when the attribute value is the string `"false"`.
 * Returns `undefined` when the attribute is absent, letting the renderer use its default.
 */
function parseBoolAttr(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value !== "false";
}

/**
 * Builds creation options for the canvas ribbon and SVG renderers from an element's data attributes.
 *
 * Supported attributes:
 * - `data-trail-color`: single color string or JSON array of color strings
 * - `data-skeleton-color`: skeleton dot color
 * - `data-head-color`: head dot color
 * - `data-head-radius`: head dot radius (number)
 * - `data-trail-length`: number of trail points (integer)
 * - `data-trail-style`: `"default"`, `"gradient-static"`, or `"gradient-animated"`
 * - `data-trail-width`: trail width multiplier (number, default 1)
 * - `data-auto-start`: set to `"false"` to prevent auto-play on creation
 * - `data-pause-on-hidden`: set to `"false"` to disable tab-visibility pausing
 * - `data-initial-phase`: seek to this phase before the first frame (number)
 */
function buildOptions(el: HTMLElement) {
  const autoStart = parseBoolAttr(el.dataset.autoStart);
  const pauseOnHidden = parseBoolAttr(el.dataset.pauseOnHidden);

  return {
    ...(el.dataset.trailColor && {
      trailColor: parseTrailColor(el.dataset.trailColor),
    }),
    ...(el.dataset.skeletonColor && { skeletonColor: el.dataset.skeletonColor }),
    ...(el.dataset.headColor && { headColor: el.dataset.headColor }),
    ...(el.dataset.headRadius && { headRadius: parseFloat(el.dataset.headRadius) }),
    ...(el.dataset.trailLength && { trailLength: parseInt(el.dataset.trailLength, 10) }),
    ...(el.dataset.trailStyle && {
      trailStyle: el.dataset.trailStyle as TrailStyle,
    }),
    ...(el.dataset.trailWidth && { trailWidth: parseFloat(el.dataset.trailWidth) }),
    ...(autoStart !== undefined && { autoStart }),
    ...(pauseOnHidden !== undefined && { pauseOnHidden }),
    // `!==` undefined so that data-initial-phase="0" is correctly passed as 0
    ...(el.dataset.initialPhase !== undefined && {
      initialPhase: parseFloat(el.dataset.initialPhase),
    }),
  };
}

/**
 * Builds creation options for the dot matrix renderer from an element's data attributes.
 *
 * Supported attributes (shared):
 * - `data-trail-color`, `data-skeleton-color`, `data-trail-style`, `data-trail-length`
 * - `data-auto-start`, `data-pause-on-hidden`, `data-initial-phase`
 *
 * Dot-matrix-specific:
 * - `data-cols`: number of dot columns (integer, default 32)
 * - `data-rows`: number of dot rows (integer, default 32)
 * - `data-roundness`: corner rounding, 0 = square, 1 = circle (number, default 1)
 */
function buildDotMatrixOptions(el: HTMLElement) {
  const autoStart = parseBoolAttr(el.dataset.autoStart);
  const pauseOnHidden = parseBoolAttr(el.dataset.pauseOnHidden);

  return {
    ...(el.dataset.trailColor && {
      trailColor: parseTrailColor(el.dataset.trailColor),
    }),
    ...(el.dataset.skeletonColor && { skeletonColor: el.dataset.skeletonColor }),
    ...(el.dataset.trailStyle && {
      trailStyle: el.dataset.trailStyle as TrailStyle,
    }),
    ...(el.dataset.trailLength && { trailLength: parseInt(el.dataset.trailLength, 10) }),
    ...(autoStart !== undefined && { autoStart }),
    ...(pauseOnHidden !== undefined && { pauseOnHidden }),
    ...(el.dataset.initialPhase !== undefined && {
      initialPhase: parseFloat(el.dataset.initialPhase),
    }),
    ...(el.dataset.cols && { cols: parseInt(el.dataset.cols, 10) }),
    ...(el.dataset.rows && { rows: parseInt(el.dataset.rows, 10) }),
    ...(el.dataset.roundness && { roundness: parseFloat(el.dataset.roundness) }),
  };
}

/**
 * Scans for `<canvas data-sarmal="curveName">` and `<svg data-sarmal="curveName">`
 *  when **DOMContentLoaded** is triggered, and creates a Sarmal instance for each one.
 *
 * Renderer selection:
 * - `svg[data-sarmal]` → SVG renderer (`createSarmalSVG`)
 * - `canvas[data-sarmal]` with no `data-renderer`, or `data-renderer="canvas"` → canvas ribbon renderer (`createSarmal`)
 * - `canvas[data-sarmal][data-renderer="dot-matrix"]` → dot matrix renderer (`createSarmalDotMatrix`)
 * - `canvas[data-sarmal]` with any other `data-renderer` value → `console.error`, element skipped
 */
export function init() {
  const elements = document.querySelectorAll<HTMLElement>("canvas[data-sarmal], svg[data-sarmal]");

  elements.forEach((el) => {
    const curveName = el.getAttribute("data-sarmal");
    if (curveName == null) {
      return console.warn("[sarmal] curveName is required");
    }

    const curveDef = curves[curveName as CurveName];
    if (!curveDef) {
      return console.error(`[sarmal] "${curveName}" is not a valid curve name`);
    }

    const renderer = el.dataset.renderer;

    if (
      el instanceof HTMLCanvasElement &&
      renderer !== undefined &&
      renderer !== "canvas" &&
      renderer !== "dot-matrix"
    ) {
      return console.error(
        `[sarmal] Unknown data-renderer value: "${renderer}". Expected "canvas" or "dot-matrix".`,
      );
    }

    const instance =
      el instanceof HTMLCanvasElement && renderer === "dot-matrix"
        ? createSarmalDotMatrix(el, curveDef, buildDotMatrixOptions(el))
        : el instanceof HTMLCanvasElement
          ? createSarmal(el, curveDef, buildOptions(el))
          : createSarmalSVG(el as unknown as SVGSVGElement, curveDef, buildOptions(el));

    if (el.dataset.speed) {
      instance.setSpeed(parseFloat(el.dataset.speed));
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(init);
  });
} else {
  requestAnimationFrame(init);
}
