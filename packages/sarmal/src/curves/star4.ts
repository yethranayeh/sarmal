import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function star4Fn(phase: number, _elapsed: number, _params: Record<string, number>) {
  const r =
    Math.abs(Math.cos(2 * phase)) +
    0.35 * Math.abs(Math.cos(6 * phase)) +
    0.15 * Math.abs(Math.cos(10 * phase));
  return {
    x: r * Math.cos(phase),
    y: r * Math.sin(phase),
  };
}

/**
 * 4-pointed star based on Fourier harmonics.
 * Same construction as `star` but with base frequency `2*phase`, producing 4 tips.
 */
export const star4: CurveDef = {
  name: "Star (4-arm)",
  fn: star4Fn,
  period: TWO_PI,
  speed: 1.0,
};
