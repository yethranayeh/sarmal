import { describe, it, expect } from "vitest";
import {
  evaluateCatmullRom,
  buildSplinePath,
  buildClosingPath,
  buildDrawCurveDef,
  type DrawingSegment,
} from "./catmull-rom";

const EPSILON = 1e-10;

function expectNear(a: number, b: number, eps = EPSILON) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

// ── catmullRomEval ───────────────────────────────────────────────

describe("catmullRomEval", () => {
  it("returns (0,0) for empty points", () => {
    const p = evaluateCatmullRom([], 0);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it("returns the single point for any t", () => {
    const p = evaluateCatmullRom([[0.5, -0.3]], Math.PI);
    expect(p.x).toBe(0.5);
    expect(p.y).toBe(-0.3);
  });

  it("passes exactly through control points at segment starts", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const N = points.length;
    const segmentSize = (2 * Math.PI) / N;

    for (let i = 0; i < N; i++) {
      const t = i * segmentSize;
      const p = evaluateCatmullRom(points, t);
      expectNear(p.x, points[i]![0]);
      expectNear(p.y, points[i]![1]);
    }
  });

  it("is periodic: t=0 and t=2π give the same point", () => {
    const points: Array<DrawingSegment> = [
      [0.2, 0.3],
      [0.8, -0.5],
      [-0.4, 0.9],
    ];
    const a = evaluateCatmullRom(points, 0);
    const b = evaluateCatmullRom(points, 2 * Math.PI);
    expectNear(a.x, b.x);
    expectNear(a.y, b.y);
  });

  it("wraps negative t correctly", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const a = evaluateCatmullRom(points, -Math.PI);
    const b = evaluateCatmullRom(points, Math.PI); // -π ≡ +π mod 2π
    expectNear(a.x, b.x);
    expectNear(a.y, b.y);
  });

  it("wraps t > 2π correctly", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const a = evaluateCatmullRom(points, Math.PI / 2);
    const b = evaluateCatmullRom(points, Math.PI / 2 + 4 * Math.PI);
    expectNear(a.x, b.x);
    expectNear(a.y, b.y);
  });

  it("uses phantom points for the first segment (predecessor = last point)", () => {
    // A 3-point triangle. The first segment's phantom predecessor
    // is points[2], so the spline at t=0 should still be points[0].
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    const p = evaluateCatmullRom(points, 0);
    expectNear(p.x, 0);
    expectNear(p.y, 0);
  });

  it("uses phantom points for the last segment (successor = first point)", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    const N = points.length;
    const segmentSize = (2 * Math.PI) / N;
    // End of last segment should land exactly on points[0]
    const p = evaluateCatmullRom(points, (N - 1) * segmentSize + segmentSize * 0.999999);
    expectNear(p.x, points[0]![0], 1e-6);
    expectNear(p.y, points[0]![1], 1e-6);
  });

  it("is continuous across segment boundaries", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const N = points.length;
    const segmentSize = (2 * Math.PI) / N;

    for (let i = 1; i < N; i++) {
      const tLeft = i * segmentSize - 1e-9;
      const tRight = i * segmentSize + 1e-9;
      const pLeft = evaluateCatmullRom(points, tLeft);
      const pRight = evaluateCatmullRom(points, tRight);
      expectNear(pLeft.x, pRight.x, 1e-5);
      expectNear(pLeft.y, pRight.y, 1e-5);
    }
  });

  it("evaluates correct mid-segment curvature (not just linear interpolation)", () => {
    // Square: Catmull-Rom dips below the bottom edge at the midpoint because
    // phantom neighbors pull the curve. Linear interpolation gives y=0 here.
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const segmentSize = (2 * Math.PI) / 4;
    const p = evaluateCatmullRom(points, segmentSize * 0.5);
    expectNear(p.x, 0.5);
    expectNear(p.y, -0.125);
  });

  it("evaluates two-point loop without throwing", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 1],
    ];
    const p = evaluateCatmullRom(points, Math.PI);
    expect(typeof p.x).toBe("number");
    expect(typeof p.y).toBe("number");
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

// ── buildSplinePath ──────────────────────────────────────────────

describe("buildSplinePath", () => {
  it("returns empty string for 0 points", () => {
    expect(buildSplinePath([])).toBe("");
  });

  it("returns empty string for 1 point", () => {
    expect(buildSplinePath([[0, 0]])).toBe("");
  });

  it("returns a single M..C segment for 2 points", () => {
    const path = buildSplinePath([
      [0, 0],
      [1, 0],
    ]);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.includes(" C ")).toBe(true);
    // M x y C c1x c1y c2x c2y ex ey = 10 parts
    const parts = path.trim().split(" ");
    expect(parts.length).toBe(10);
  });

  it("starts with M and continues with C for 3+ points", () => {
    const path = buildSplinePath([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    const trimmed = path.trim();
    expect(trimmed.startsWith("M ")).toBe(true);
    // Two segments: M ... C ... C ...
    const cCount = (trimmed.match(/ C /g) || []).length;
    expect(cCount).toBe(2); // one from first segment, one from second
  });

  it("contains N-1 cubic segments for N points (N >= 2)", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    const path = buildSplinePath(points);
    const mCount = (path.match(/M /g) || []).length;
    const cCount = (path.match(/ C /g) || []).length;
    // 1 M + (N-2) additional C commands = N-1 segments total
    expect(mCount).toBe(1);
    expect(cCount).toBe(points.length - 1);
  });

  it("first M command lands on the first control point", () => {
    const points: Array<DrawingSegment> = [
      [0.25, -0.75],
      [1, 0],
      [0.5, 0.5],
    ];
    const path = buildSplinePath(points);
    const parts = path.trim().split(" ");
    // parts[0] = "M", parts[1] = x, parts[2] = y
    expect(parts[0]).toBe("M");
    expect(parseFloat(parts[1]!)).toBe(points[0]![0]);
    expect(parseFloat(parts[2]!)).toBe(points[0]![1]);
  });
});

// ── buildClosingPath ─────────────────────────────────────────────

describe("buildClosingPath", () => {
  it("returns empty string for 0 points", () => {
    expect(buildClosingPath([])).toBe("");
  });

  it("returns empty string for 1 point", () => {
    expect(buildClosingPath([[0, 0]])).toBe("");
  });

  it("returns a single M..C segment for 2 points", () => {
    const path = buildClosingPath([
      [0, 0],
      [1, 0],
    ]);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.includes(" C ")).toBe(true);
    const parts = path.trim().split(" ");
    expect(parts.length).toBe(10);
  });

  it("returns a single M..C segment for 3+ points", () => {
    const path = buildClosingPath([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.includes(" C ")).toBe(true);
    const mCount = (path.match(/M /g) || []).length;
    const cCount = (path.match(/ C /g) || []).length;
    expect(mCount).toBe(1);
    expect(cCount).toBe(1);
  });

  it("M command lands on the last control point", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ];
    const path = buildClosingPath(points);
    const parts = path.trim().split(" ");
    expect(parts[0]).toBe("M");
    expect(parseFloat(parts[1]!)).toBe(points[points.length - 1]![0]);
    expect(parseFloat(parts[2]!)).toBe(points[points.length - 1]![1]);
  });

  it("Bézier endpoint lands on points[0]", () => {
    const points: Array<DrawingSegment> = [
      [0.3, -0.7],
      [0.9, 0.1],
      [0.5, 0.5],
    ];
    const path = buildClosingPath(points);
    const parts = path.trim().split(" ");
    // "M x y C c1x c1y c2x c2y ex ey" — endpoint is at indices 8 and 9
    expectNear(parseFloat(parts[8]!), points[0]![0]);
    expectNear(parseFloat(parts[9]!), points[0]![1]);
  });

  it("Bézier control points match the spec formula", () => {
    // points = [(0,0),(1,0),(0.5,0.5)], closing segment: P[2]→P[0]
    // p0=P[1]=(1,0), p1=P[2]=(0.5,0.5), p2=P[0]=(0,0), p3=P[1]=(1,0)
    // ctrl1 = p1 + (p2-p0)/6 = (0.5+(0-1)/6, 0.5+(0-0)/6) = (1/3, 0.5)
    // ctrl2 = p2 - (p3-p1)/6 = (0-(1-0.5)/6, 0-(0-0.5)/6) = (-1/12, 1/12)
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ];
    const path = buildClosingPath(points);
    const parts = path.trim().split(" ");
    // "M 0.5 0.5 C ctrl1x ctrl1y ctrl2x ctrl2y 0 0"
    //  [0] [1]  [2][3]   [4]    [5]    [6]    [7][8][9]
    expectNear(parseFloat(parts[4]!), 1 / 3);
    expectNear(parseFloat(parts[5]!), 0.5);
    expectNear(parseFloat(parts[6]!), -1 / 12);
    expectNear(parseFloat(parts[7]!), 1 / 12);
    expectNear(parseFloat(parts[8]!), 0);
    expectNear(parseFloat(parts[9]!), 0);
  });
});

// ── buildDrawCurveDef ────────────────────────────────────────────

describe("buildDrawCurveDef", () => {
  it("returns a CurveDef with correct name and period", () => {
    const points: Array<DrawingSegment> = [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ];
    const def = buildDrawCurveDef(points);
    expect(def.name).toBe("custom");
    expect(def.period).toBe(2 * Math.PI);
    expect(typeof def.fn).toBe("function");
  });

  it("fn(0) returns the first control point", () => {
    const points: Array<DrawingSegment> = [
      [0.2, -0.4],
      [0.8, 0.6],
      [-0.3, 0.1],
    ];
    const def = buildDrawCurveDef(points);
    const p = def.fn(0);
    expectNear(p.x, 0.2);
    expectNear(p.y, -0.4);
  });
});
