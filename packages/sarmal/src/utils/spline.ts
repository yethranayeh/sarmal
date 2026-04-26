import type { CurveDef, Point } from "../types";

export interface SplineOptions {
  /**
   * Optional name for the curve definition
   * @default "Spline"
   */
  name?: string;
  /**
   * Base speed of the animation
   * @default 1
   */
  speed?: number;
  /**
   * Whether the curve should loop back to the start
   * @default true
   */
  closed?: boolean;
  /**
   * Tension parameter. 0.5 is centripetal (recommended). 0.0 is uniform. 1.0 is chordal.
   * @default 0.5
   */
  alpha?: number;
}

/**
 * Creates a parametric CurveDef from a set of control points using
 * a Centripetal Catmull-Rom spline.
 *
 * This ensures the curve passes through all points and avoids self-intersections
 * or extreme overshoots when points are close together.
 */
export function createSplineCurve(points: Point[], options: SplineOptions = {}): CurveDef {
  const { name = "Spline", speed = 1, closed = true, alpha = 0.5 } = options;

  if (points.length < 2) {
    throw new Error("[sarmal] Spline requires at least 2 points");
  }

  // Prep points for Catmull-Rom (Immutable)
  const pts = closed
    ? [points[points.length - 1]!, ...points, points[0]!, points[1]!]
    : (() => {
        const p0 = points[0]!;
        const p1 = points[1] ?? p0;
        const pn_1 = points[points.length - 1]!;
        const pn_2 = points[points.length - 2] ?? pn_1;
        return [
          { x: p0.x - (p1.x - p0.x), y: p0.y - (p1.y - p0.y) },
          ...points,
          { x: pn_1.x + (pn_1.x - pn_2.x), y: pn_1.y + (pn_1.y - pn_2.y) },
        ];
      })();

  // Precompute knots using scan/reduce (Pure mapping)
  const knots = pts.reduce<number[]>((acc, p, i) => {
    if (i === 0) return [0];
    const prev = pts[i - 1]!;
    const dist = Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
    return [...acc, acc[acc.length - 1]! + Math.pow(dist, alpha) + 0.0001];
  }, []);

  const startKnot = knots[1]!;
  const endKnot = knots[pts.length - 2]!;
  const period = endKnot - startKnot;

  const remap = (a: Point, b: Point, ta: number, tb: number, t: number): Point => {
    const s = (tb - t) / (tb - ta);
    const s2 = (t - ta) / (tb - ta);
    return {
      x: a.x * s + b.x * s2,
      y: a.y * s + b.y * s2,
    };
  };

  const evaluate = (t: number): Point => {
    const wrappedT = t % period;
    const isEnd = t > 0 && Math.abs(wrappedT) < 0.000001;
    const knotT = startKnot + (isEnd ? period : wrappedT);

    // Find segment (Robust loop to handle float precision)
    let i = 1;
    const maxI = pts.length - 3;
    while (i < maxI && knotT > knots[i + 1]! + 0.000001) {
      i++;
    }

    const t0 = knots[i - 1]!, t1 = knots[i]!, t2 = knots[i + 1]!, t3 = knots[i + 2]!;
    const p0 = pts[i - 1]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2]!;

    const a1 = remap(p0, p1, t0, t1, knotT);
    const a2 = remap(p1, p2, t1, t2, knotT);
    const a3 = remap(p2, p3, t2, t3, knotT);

    const b1 = remap(a1, a2, t0, t2, knotT);
    const b2 = remap(a2, a3, t1, t3, knotT);

    return remap(b1, b2, t1, t2, knotT);
  };

  return {
    name,
    fn: evaluate,
    period,
    speed,
  };
}
