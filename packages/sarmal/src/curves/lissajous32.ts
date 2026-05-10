import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function lissajous32Fn(phase: number, elapsed: number, _params: Record<string, number>) {
  const phi = elapsed * 0.45;
  return {
    x: Math.sin(3 * phase + phi),
    y: Math.sin(2 * phase),
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
