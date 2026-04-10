import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function deltoidFn(t: number, _time: number, _params: Record<string, number>) {
  return {
    x: 2 * Math.cos(t) + Math.cos(2 * t),
    y: 2 * Math.sin(t) - Math.sin(2 * t),
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
