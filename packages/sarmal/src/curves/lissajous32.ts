import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function lissajous32Fn(t: number, time: number, _params: Record<string, number>) {
  const phi = time * 0.45;
  return {
    x: Math.sin(3 * t + phi),
    y: Math.sin(2 * t),
  };
}

/**
 * Lissajous curve with frequency ratio 3:2
 * Creates a figure-eight-like pattern with live skeleton
 */
export const lissajous32: CurveDef = {
  name: "Lissajous 3:2",
  fn: lissajous32Fn,
  period: TWO_PI,
  speed: 2.0,
  skeleton: "live",
};
