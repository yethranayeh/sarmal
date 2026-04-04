/**
 * Scans for `<canvas data-sarmal="curveName">` when DOMContentLoaded is triggered,
 *  and creates a Sarmal instance for each one
 */
import { createSarmal } from "./index";
import { curves } from "./curves";

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
    });
    sarmal.start();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
