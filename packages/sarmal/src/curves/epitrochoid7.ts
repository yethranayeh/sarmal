import type { CurveDef, Point } from "../types";

const TWO_PI = Math.PI * 2;

function epitrochoid7Fn(t: number, _time: number, _params: Record<string, number>) {
  const d = 1.0 + 0.55 * Math.sin(t * 0.5);
  return {
    x: 7 * Math.cos(t) - d * Math.cos(7 * t),
    y: 7 * Math.sin(t) - d * Math.sin(7 * t),
  };
}

function epitrochoid7SkeletonFn(t: number): Point {
  // average of the oscillating range for a stable base shape
  const d = 1.275;
  return {
    x: 7 * Math.cos(t) - d * Math.cos(7 * t),
    y: 7 * Math.sin(t) - d * Math.sin(7 * t),
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
