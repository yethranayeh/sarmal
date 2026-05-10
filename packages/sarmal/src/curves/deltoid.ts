import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function deltoidFn(phase: number, _elapsed: number, _params: Record<string, number>) {
  return {
    x: 2 * Math.cos(phase) + Math.cos(2 * phase),
    y: 2 * Math.sin(phase) - Math.sin(2 * phase),
  };
}

/**
 * Deltoid curve - a 3-cusped hypocycloid
 * Creates a triangular shape with curved sides
 */
export const deltoid: CurveDef = {
  name: "Deltoid",
  fn: deltoidFn,
  period: TWO_PI,
  speed: 0.9,
};
