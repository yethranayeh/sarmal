import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function rose5Fn(t: number, _time: number, _params: Record<string, number>) {
  const r = Math.cos(5 * t);
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
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
