import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function lameFn(t: number, time: number, _params: Record<string, number>) {
  const p = 1.75 + 1.25 * Math.sin(time * 0.48);
  const c = Math.cos(t),
    s = Math.sin(t);
  return {
    x: Math.sign(c) * Math.pow(Math.abs(c), p),
    y: Math.sign(s) * Math.pow(Math.abs(s), p),
  };
}

/**
 * Lamé curve (superellipse) with time-varying exponent
 * Creates a squircle-like shape that morphs over time
 */
export const lame: CurveDef = {
  name: "Lamé Curve",
  fn: lameFn,
  period: TWO_PI,
  speed: 1.0,
  skeleton: "live",
};
