import type { CurveDef } from "../types";

const TWO_PI = Math.PI * 2;

/**
 * Artemis II free-return lunar trajectory
 * @see https://www.nasa.gov/wp-content/uploads/2025/09/artemis-ii-map-508.pdf
 * a = x-axis asymmetry (widens one lobe),
 * b = y-axis asymmetry,
 * ox = horizontal offset to visually center the shape
 */
function artemis2Fn(t: number, _time: number, _params: Record<string, number>) {
  const a = 0.35,
    b = 0.15,
    ox = 0.175;
  const s = Math.sin(t),
    c = Math.cos(t);
  const denom = 1 + s * s;
  return {
    x: (c * (1 + a * c)) / denom - ox,
    y: (s * c * (1 + b * c)) / denom,
  };
}

/**
 * Artemis II free-return lunar trajectory curve
 * Traces the path of the Orion spacecraft during the Artemis II mission
 */
export const artemis2: CurveDef = {
  name: "Artemis II",
  fn: artemis2Fn,
  period: TWO_PI,
  speed: 0.7,
};
