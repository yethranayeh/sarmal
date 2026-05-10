import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function lissajous43Fn(phase: number, elapsed: number, _params: Record<string, number>) {
  const phi = elapsed * 0.38;
  return {
    x: Math.sin(4 * phase + phi),
    y: Math.sin(3 * phase),
  };
}

/**
 * Lissajous curve with frequency ratio 4:3
 * Creates a complex interweaving pattern with live skeleton
 */
export const lissajous43: CurveDef = {
  name: "Lissajous 4:3",
  fn: lissajous43Fn,
  period: TWO_PI,
  speed: 1.8,
  skeleton: "live",
};
