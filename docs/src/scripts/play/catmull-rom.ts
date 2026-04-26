import type { Point } from "@sarmal/core";

export type DrawingSegment = [number, number];

const PERIOD = 2 * Math.PI;

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;

  // Standard Catmull-Rom matrix form:
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

export function evaluateCatmullRom(points: Array<DrawingSegment>, t: number): Point {
  const N = points.length;
  if (N === 0) {
    return { x: 0, y: 0 };
  }

  if (N === 1) {
    return { x: points[0]![0], y: points[0]![1] };
  }

  // Normalize t into [0, PERIOD)
  t = ((t % PERIOD) + PERIOD) % PERIOD;

  const segmentSize = PERIOD / N;
  let i = Math.floor(t / segmentSize);
  if (i >= N) {
    i = N - 1;
  }

  let u = (t - i * segmentSize) / segmentSize;
  u = Math.max(0, Math.min(1, u));

  const p0 = points[(i - 1 + N) % N]!;
  const p1 = points[i]!;
  const p2 = points[(i + 1) % N]!;
  const p3 = points[(i + 2) % N]!;

  return {
    x: catmullRom1D(p0[0], p1[0], p2[0], p3[0], u),
    y: catmullRom1D(p0[1], p1[1], p2[1], p3[1], u),
  };
}

/**
 * Converts a single segment to an SVG cubic Bézier command string
 * @param startCmd "M" for the first segment, "C" for subsequent segments
 */
function segmentToBezier(
  p0: DrawingSegment,
  p1: DrawingSegment,
  p2: DrawingSegment,
  p3: DrawingSegment,
  startCmd: "M" | "C",
) {
  const ctrl1x = p1[0] + (p2[0] - p0[0]) / 6;
  const ctrl1y = p1[1] + (p2[1] - p0[1]) / 6;
  const ctrl2x = p2[0] - (p3[0] - p1[0]) / 6;
  const ctrl2y = p2[1] - (p3[1] - p1[1]) / 6;

  if (startCmd === "M") {
    const parts = ["M", p1[0], p1[1], "C", ctrl1x, ctrl1y, ctrl2x, ctrl2y, p2[0], p2[1]];
    return parts.join(" ");
  }

  // Subsequent segments: just the cubic bezier continuation
  const parts = ["C", ctrl1x, ctrl1y, ctrl2x, ctrl2y, p2[0], p2[1]];
  return parts.join(" ");
}

/**
 * Build an SVG path string
 * ! Returns empty string if fewer than 2 points
 */
export function buildSplinePath(points: Array<DrawingSegment>) {
  const N = points.length;
  if (N < 2) {
    return "";
  }

  const segments: Array<string> = [];
  for (let i = 0; i < N - 1; i++) {
    const p0 = points[(i - 1 + N) % N]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % N]!;
    const p3 = points[(i + 2) % N]!;
    const cmd: "M" | "C" = i === 0 ? "M" : "C";
    segments.push(segmentToBezier(p0, p1, p2, p3, cmd));
  }
  return segments.join(" ");
}

/**
 * Build an SVG path string
 * ! Returns empty string if fewer than 2 points
 */
export function buildClosingPath(points: Array<DrawingSegment>) {
  const N = points.length;
  if (N < 2) {
    return "";
  }

  const i = N - 1;
  const p0 = points[(i - 1 + N) % N]!;
  const p1 = points[i]!;
  const p2 = points[(i + 1) % N]!; // wraps to P[0]
  const p3 = points[(i + 2) % N]!; // wraps to P[1]

  return segmentToBezier(p0, p1, p2, p3, "M");
}

/** Builds a full CurveDef from draw-mode points for convenience */
export const buildDrawCurveDef = (points: Array<DrawingSegment>) => ({
  name: "custom" as const,
  fn: (t: number) => evaluateCatmullRom(points, t),
  period: PERIOD,
});
