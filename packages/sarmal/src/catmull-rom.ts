import type { Point, CurveDef } from "./types";

/**
 * One full loop around the spline maps to the parametric interval `[0, 2π)`,
 *  matching the convention for built-in curves.
 */
const PERIOD = 2 * Math.PI;

/**
 * Evaluates a one-dimensional Catmull-Rom spline segment given four control values.
 * The parameter `u` ranges from 0 (at `p1`) to 1 (at `p2`).
 * `p0` and `p3` are the phantom neighbours that influence the tangent at each endpoint.
 */
function catmullRom1D(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;

  // The standard Catmull-Rom matrix form
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * u +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  );
}

/**
 * Evaluates a closed Catmull-Rom spline through every point in `points`
 *
 * The spline treats `points` as a **closed loop**
 * The last point wraps back to the first,
 *  and each segment uses a phantom predecessor / successor so the
 *    curve passes exactly through every control point.
 *
 * @param points  At least 1 point.  An empty array yields `(0, 0)`.  A single point returns that point for every `t`
 * @param t       Parametric position along the closed loop.  Wraps into `[0, 2π)` automatically, so values outside that range are remapped rather than rejected
 * @returns       The `(x, y)` position on the spline at time `t`
 */
export function evaluateCatmullRom(points: Array<[number, number]>, t: number): Point {
  const N = points.length;

  if (N === 0) {
    return { x: 0, y: 0 };
  }

  if (N === 1) {
    return { x: points[0]![0], y: points[0]![1] };
  }

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
 * The returned curve definition produces a closed Catmull-Rom spline that
 *  passes through every point in order, looping back from the last point to the first.
 *
 * @param points  Array of control points in **normalized `[−1, 1]` space**,
 *                  matching the playground's draw-mode coordinate system.
 *                ! Must contain at least 3 points.
 * @returns       A `CurveDef` with `period: 2π` and the spline evaluator as its `fn`.
 *                `name` is set to `"custom"`.
 * @throws        If `points` has fewer than 3 entries.
 *
 * @example
 * ```ts
 * import { createSarmal, drawCurve } from '@sarmal/core'
 *
 * const curve = drawCurve([
 *   [-0.5,  0.3],
 *   [ 0.2, -0.8],
 *   [ 0.7,  0.4],
 * ])
 *
 * createSarmal(canvas, curve)
 * ```
 */
export function drawCurve(points: Array<[number, number]>): CurveDef {
  if (points.length < 3) {
    throw new Error(`drawCurve requires at least 3 points, received ${points.length}.`);
  }

  return {
    name: "custom",
    fn: (t: number) => evaluateCatmullRom(points, t),
    period: PERIOD,
  };
}
