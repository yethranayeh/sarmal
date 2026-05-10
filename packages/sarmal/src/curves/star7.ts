import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function star7Fn(phase: number, _elapsed: number, _params: Record<string, number>) {
  const r =
    Math.abs(Math.cos((7 / 2) * phase)) +
    0.35 * Math.abs(Math.cos((21 / 2) * phase)) +
    0.15 * Math.abs(Math.cos((35 / 2) * phase));
  return {
    x: r * Math.cos(phase),
    y: r * Math.sin(phase),
  };
}

/**
 * 7-pointed star based on Fourier harmonics.
 * Same construction as `star` but with base frequency `7*phase/2`, producing 7 tips.
 */
export const star7: CurveDef = {
  name: "Star (7-arm)",
  fn: star7Fn,
  period: TWO_PI,
  speed: 1.0,
};
