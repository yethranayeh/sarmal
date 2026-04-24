import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function star7Fn(t: number, _time: number, _params: Record<string, number>) {
  const r =
    Math.abs(Math.cos((7 / 2) * t)) +
    0.35 * Math.abs(Math.cos((21 / 2) * t)) +
    0.15 * Math.abs(Math.cos((35 / 2) * t));
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
  };
}

/**
 * 7-pointed star based on Fourier harmonics.
 * Same construction as `star` but with base frequency `7t/2`, producing 7 tips.
 */
export const star7: CurveDef = {
  name: "Star (7-arm)",
  fn: star7Fn,
  period: TWO_PI,
  speed: 1.0,
};
