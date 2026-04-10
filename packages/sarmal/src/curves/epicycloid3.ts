import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function epicycloid3Fn(t: number, _time: number, _params: Record<string, number>) {
  return {
    x: 4 * Math.cos(t) - Math.cos(4 * t),
    y: 4 * Math.sin(t) - Math.sin(4 * t),
  };
}

/**
 * Epicycloid with 3 cusps
 * Creates a three-pointed star shape
 */
export const epicycloid3: CurveDef = {
  name: "Epicycloid (n=3)",
  fn: epicycloid3Fn,
  period: TWO_PI,
  speed: 0.75,
};
