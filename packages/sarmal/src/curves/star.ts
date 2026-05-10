import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function starFn(phase: number, _elapsed: number, _params: Record<string, number>) {
  const r =
    Math.abs(Math.cos((5 / 2) * phase)) +
    0.35 * Math.abs(Math.cos((15 / 2) * phase)) +
    0.15 * Math.abs(Math.cos((25 / 2) * phase));
  return {
    x: r * Math.cos(phase),
    y: r * Math.sin(phase),
  };
}

/**
 * 5-pointed star based on Fourier harmonics.
 */
export const star: CurveDef = {
  name: "Star",
  fn: starFn,
  period: TWO_PI,
  speed: 1.0,
};
