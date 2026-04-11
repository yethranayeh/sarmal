/**
 * Scans for `<canvas data-sarmal="curveName">` when DOMContentLoaded is triggered,
 *  and creates a Sarmal instance for each one
 */
import { createSarmal } from "./index";
import { curves } from "./curves";
import type { PalettePreset } from "./types";

/**
 * Parses a palette value from a data attribute.
 * Tries to parse as JSON array first, falls back to preset name.
 */
function parsePalette(value: string): PalettePreset | string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed as string[];
    }
  } catch {
    // Not a valid JSON array, treat as preset name
  }
  return value as PalettePreset;
}

function init(): void {
  const canvases = document.querySelectorAll<HTMLCanvasElement>("canvas[data-sarmal]");

  canvases.forEach((canvas) => {
    const curveName = canvas.getAttribute("data-sarmal");
    if (curveName == null) {
      return console.warn("[sarmal] curveName isrequried");
    }

    const curveDef = curves[curveName];
    if (!curveDef) {
      return console.error(`[sarmal] "${curveName}" is not a valid curve name`);
    }

    const sarmal = createSarmal(canvas, curveDef, {
      ...(canvas.dataset.trailColor && { trailColor: canvas.dataset.trailColor }),
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
      ...(canvas.dataset.palette && { palette: parsePalette(canvas.dataset.palette) }),
    });
    sarmal.start();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    requestAnimationFrame(init);
  });
} else {
  requestAnimationFrame(init);
}
