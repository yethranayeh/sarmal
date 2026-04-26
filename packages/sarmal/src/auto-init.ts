import type { TrailColor } from "./types";
import type { CurveName } from "./curves";

/**
 * Scans for `<canvas data-sarmal="curveName">` when DOMContentLoaded is triggered,
 *  and creates a Sarmal instance for each one
 */
import { createSarmal, createSplineCurve } from "./index";
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

export function init() {
  const canvases = document.querySelectorAll<HTMLCanvasElement>("canvas[data-sarmal]");

  canvases.forEach((canvas) => {
    const curveName = canvas.getAttribute("data-sarmal");
    if (curveName == null) {
      return console.warn("[sarmal] curveName is required");
    }

    let curveDef = curves[curveName as CurveName];

    if (curveName === "custom" && canvas.dataset.points) {
      try {
        const points = JSON.parse(canvas.dataset.points);
        if (Array.isArray(points)) {
          const normPoints = points.map((p: any) =>
            Array.isArray(p) ? { x: p[0], y: p[1] } : p
          );
          curveDef = createSplineCurve(normPoints, { name: "Custom" });
        }
      } catch (e) {
        console.error("[sarmal] Failed to parse data-points", e);
      }
    }

    if (!curveDef) {
      return console.error(`[sarmal] "${curveName}" is not a valid curve name`);
    }

    const instance = createSarmal(canvas, curveDef, {
      ...(canvas.dataset.trailColor && {
        trailColor: parseTrailColor(canvas.dataset.trailColor),
      }),
      ...(canvas.dataset.skeletonColor && { skeletonColor: canvas.dataset.skeletonColor }),
      ...(canvas.dataset.headColor && { headColor: canvas.dataset.headColor }),
      ...(canvas.dataset.headRadius && { headRadius: parseFloat(canvas.dataset.headRadius) }),
      ...(canvas.dataset.trailLength && { trailLength: parseInt(canvas.dataset.trailLength, 10) }),
      ...(canvas.dataset.trailStyle && {
        trailStyle: canvas.dataset.trailStyle as
          | "default"
          | "gradient-static"
          | "gradient-animated",
      }),
    });

    if (canvas.dataset.speed) {
      instance.setSpeed(parseFloat(canvas.dataset.speed));
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
