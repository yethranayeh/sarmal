import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function epicycloid3Fn(phase: number, _elapsed: number, _params: Record<string, number>) {
  return {
    x: 4 * Math.cos(phase) - Math.cos(4 * phase),
    y: 4 * Math.sin(phase) - Math.sin(4 * phase),
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
