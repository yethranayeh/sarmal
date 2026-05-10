import type { CurveDef, Point } from "../types";

const TWO_PI = Math.PI * 2;

function epitrochoid7Fn(phase: number, _elapsed: number, _params: Record<string, number>) {
  const d = 1.0 + 0.55 * Math.sin(phase * 0.5);
  return {
    x: 7 * Math.cos(phase) - d * Math.cos(7 * phase),
    y: 7 * Math.sin(phase) - d * Math.sin(7 * phase),
  };
}

function epitrochoid7SkeletonFn(phase: number): Point {
  // average of the oscillating range for a stable base shape
  const d = 1.275;
  return {
    x: 7 * Math.cos(phase) - d * Math.cos(7 * phase),
    y: 7 * Math.sin(phase) - d * Math.sin(7 * phase),
  };
}

/**
 * Epitrochoid with 7 lobes and dynamic variation
 * Creates a flower-like pattern with undulating petals
 */
export const epitrochoid7: CurveDef = {
  name: "Epitrochoid",
  fn: epitrochoid7Fn,
  period: TWO_PI,
  speed: 1.4,
  skeletonFn: epitrochoid7SkeletonFn,
};
