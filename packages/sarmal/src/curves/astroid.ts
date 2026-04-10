import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

function astroidFn(t: number, _time: number, _params: Record<string, number>) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {
    x: c * c * c,
    y: s * s * s,
  };
}

/**
 * Astroid curve - a 4-cusped hypocycloid
 * Creates a star-like shape with four sharp corners
 */
export const astroid: CurveDef = {
  name: "Astroid",
  fn: astroidFn,
  period: TWO_PI,
  speed: 1.1,
};
