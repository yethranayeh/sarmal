import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function rose5Fn(phase: number, _elapsed: number, _params: Record<string, number>) {
  const r = Math.cos(5 * phase);
  return {
    x: r * Math.cos(phase),
    y: r * Math.sin(phase),
  };
}

/**
 * Rose curve with 5 petals
 * Creates a five-petaled flower pattern
 */
export const rose5: CurveDef = {
  name: "Rose (n=5)",
  fn: rose5Fn,
  period: TWO_PI,
  speed: 1.0,
};
