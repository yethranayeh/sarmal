import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function rose3Fn(t: number, _time: number, _params: Record<string, number>) {
  const r = Math.cos(3 * t);
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
  };
}

/**
 * Rose curve with 3 petals
 * Creates a three-petaled flower pattern
 */
export const rose3: CurveDef = {
  name: "Rose (n=3)",
  fn: rose3Fn,
  period: TWO_PI,
  speed: 1.15,
};
