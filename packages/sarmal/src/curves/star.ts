import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function starFn(t: number, _time: number, _params: Record<string, number>) {
  const r =
    Math.abs(Math.cos((5 / 2) * t)) +
    0.35 * Math.abs(Math.cos((15 / 2) * t)) +
    0.15 * Math.abs(Math.cos((25 / 2) * t));
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
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
