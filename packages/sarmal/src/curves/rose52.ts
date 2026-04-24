import type { CurveDef } from "../types";

const FOUR_PI = Math.PI * 4;

function rose52Fn(t: number, _time: number, _params: Record<string, number>) {
  const r = Math.cos((5 / 2) * t);
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
  };
}

/**
 * Rose curve with n=5/2 that traces 5 petals over two full revolutions
 * The head passes through the center between petals, creating elegant crossing trails.
 */
export const rose52: CurveDef = {
  name: "Rose (n=5/2)",
  fn: rose52Fn,
  period: FOUR_PI,
  speed: 0.8,
};
