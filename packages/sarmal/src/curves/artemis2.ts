import type { ControlPoint, CurveDef } from "../types";

import { drawCurve } from "../catmull-rom";

const points: Array<ControlPoint> = [
  [-0.44, -0.45],
  [-0.53, -0.77],
  [-0.82, -0.66],
  [-0.82, -0.18],
  [-0.25, -0.04],
  [0.16, -0.49],
  [-0.03, -0.87],
  [-0.68, -0.94],
  [-0.95, -0.61],
  [-0.87, -0.0],
  [-0.34, 0.21],
  [0.27, -0.04],
  [0.87, 0.06],
  [0.87, 0.57],
  [0.32, 0.66],
  [-0.21, -0.43],
  [-0.43, -0.81],
  [-0.69, -0.84],
  [-0.87, -0.66],
  [-0.9, -0.47],
  [-0.76, -0.35],
];

export const artemis2: CurveDef = {
  ...drawCurve(points, { name: "Artemis II" }),
  speed: 0.7,
};
