import type { TrailColor } from "./types";
import type { CurveName } from "./curves";

import { createSarmal, createSarmalSVG } from "./index";
import { curves } from "./curves";

/**
 * Parses the `data-trail-color` attribute, which accepts either a single hex string
 *  or a JSON array of hex strings.
 *
 * Anything that does not parse as a JSON array is passed through as a string,
 *  so the library's own validator produces a meaningful error.
 *
 * @example "#ff0000"
 * @example '["#ff0000","#00ff00"]'
 */
function parseTrailColor(value: string): TrailColor {
  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed as string[];
    }
  } catch {
    // Will delegate further validtion to renderer. Will treat it as a single hex string here
  }
  return value;
}

function buildOptions(el: HTMLElement) {
  return {
    ...(el.dataset.trailColor && {
      trailColor: parseTrailColor(el.dataset.trailColor),
    }),
    ...(el.dataset.skeletonColor && { skeletonColor: el.dataset.skeletonColor }),
    ...(el.dataset.headColor && { headColor: el.dataset.headColor }),
    ...(el.dataset.headRadius && { headRadius: parseFloat(el.dataset.headRadius) }),
    ...(el.dataset.trailLength && { trailLength: parseInt(el.dataset.trailLength, 10) }),
    ...(el.dataset.trailStyle && {
      trailStyle: el.dataset.trailStyle as "default" | "gradient-static" | "gradient-animated",
    }),
  };
}

/**
 * Scans for `<canvas data-sarmal="curveName">` and `<svg data-sarmal="curveName">`
 *  when **DOMContentLoaded** is triggered, and creates a Sarmal instance for each one.
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

    const options = buildOptions(el);

    const instance =
      el instanceof HTMLCanvasElement
        ? createSarmal(el, curveDef, options)
        : createSarmalSVG(el as unknown as SVGSVGElement, curveDef, options);

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
