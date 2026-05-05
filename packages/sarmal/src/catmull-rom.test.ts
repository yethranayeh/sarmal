import { describe, it, expect, vi } from "vitest";
import type { ControlPoint } from "./types";
import { evaluateCatmullRom, drawCurve } from "./catmull-rom";

const EPSILON = 1e-10;

function expectNear(a: number, b: number, eps = EPSILON) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("evaluateCatmullRom", () => {
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
    const points: Array<ControlPoint> = [
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
    const points: Array<ControlPoint> = [
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
    const points: Array<ControlPoint> = [
      [0, 0],
      [1, 0],
      [1, 1],
    ];
    const a = evaluateCatmullRom(points, -Math.PI);
    const b = evaluateCatmullRom(points, Math.PI);
    expectNear(a.x, b.x);
    expectNear(a.y, b.y);
  });

  it("wraps t > 2π correctly", () => {
    const points: Array<ControlPoint> = [
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
    const points: Array<ControlPoint> = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    const p = evaluateCatmullRom(points, 0);
    expectNear(p.x, 0);
    expectNear(p.y, 0);
  });

  it("uses phantom points for the last segment (successor = first point)", () => {
    const points: Array<ControlPoint> = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    const N = points.length;
    const segmentSize = (2 * Math.PI) / N;
    const p = evaluateCatmullRom(points, (N - 1) * segmentSize + segmentSize * 0.999999);
    expectNear(p.x, points[0]![0], 1e-6);
    expectNear(p.y, points[0]![1], 1e-6);
  });

  it("is continuous across segment boundaries", () => {
    const points: Array<ControlPoint> = [
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
    const points: Array<ControlPoint> = [
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
    const points: Array<ControlPoint> = [
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

describe("drawCurve", () => {
  it("returns a CurveDef with name 'drawn' and period 2π", () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ];
    const def = drawCurve(points);
    expect(def.name).toBe("drawn");
    expect(def.period).toBe(2 * Math.PI);
    expect(typeof def.fn).toBe("function");
  });

  it("accepts a custom name via opts", () => {
    const points: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ];
    const def = drawCurve(points, { name: "my-shape" });
    expect(def.name).toBe("my-shape");
  });

  it("is immune to mutation of the input array after creation", () => {
    const points: Array<ControlPoint> = [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ];
    const def = drawCurve(points);
    const before = def.fn(0, 0, {});
    points.push([2, 2]);
    points[0] = [999, 999];
    const after = def.fn(0, 0, {});
    expectNear(after.x, before.x);
    expectNear(after.y, before.y);
  });

  it("warns when all control points are identical", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    drawCurve([
      [0.5, 0.5],
      [0.5, 0.5],
      [0.5, 0.5],
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("all control points are identical"),
    );
    warnSpy.mockRestore();
  });

  it("does not warn when points are close but not identical", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    drawCurve([
      [0.5, 0.5],
      [0.5, 0.5001],
      [0.5001, 0.5],
    ]);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("identical"));
    warnSpy.mockRestore();
  });

  it("warns when control points extend far outside [-1, 1]", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    drawCurve([
      [0, 0],
      [3, 0],
      [0, 0.5],
    ]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("off-screen"));
    warnSpy.mockRestore();
  });

  it("does not warn when control points are within [-2, 2]", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    drawCurve([
      [-1, -1],
      [1, 0],
      [0, 1],
    ]);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("off-screen"));
    warnSpy.mockRestore();
  });

  it("does not warn when a control point is exactly at ±2 (boundary)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    drawCurve([
      [0, 0],
      [2, 0],
      [0, -2],
    ]);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("off-screen"));
    warnSpy.mockRestore();
  });

  it("does not warn on valid input", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    drawCurve([
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("fn(0) returns the first control point", () => {
    const points: Array<ControlPoint> = [
      [0.2, -0.4],
      [0.8, 0.6],
      [-0.3, 0.1],
    ];
    const def = drawCurve(points);
    const p = def.fn(0, 0, {});
    expectNear(p.x, 0.2);
    expectNear(p.y, -0.4);
  });

  it("fn returns finite numbers for all t values", () => {
    const points: Array<ControlPoint> = [
      [0, 0],
      [1, 0],
      [0.5, 0.5],
    ];
    const def = drawCurve(points);

    for (let t = 0; t <= 2 * Math.PI; t += Math.PI / 4) {
      const p = def.fn(t, 0, {});
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("fn is periodic — t=0 and t=2π return the same point", () => {
    const points: Array<ControlPoint> = [
      [0.1, -0.2],
      [0.8, 0.3],
      [-0.5, 0.6],
    ];
    const def = drawCurve(points);
    const a = def.fn(0, 0, {});
    const b = def.fn(2 * Math.PI, 0, {});
    expectNear(a.x, b.x);
    expectNear(a.y, b.y);
  });

  it("throws when given 0 points", () => {
    expect(() => drawCurve([])).toThrow("drawCurve requires at least 3 points, received 0.");
  });

  it("throws when given 1 point", () => {
    expect(() => drawCurve([[0, 0]])).toThrow("drawCurve requires at least 3 points, received 1.");
  });

  it("throws when given 2 points", () => {
    expect(() =>
      drawCurve([
        [0, 0],
        [1, 1],
      ]),
    ).toThrow("drawCurve requires at least 3 points, received 2.");
  });

  it("does not throw with exactly 3 points", () => {
    expect(() =>
      drawCurve([
        [0, 0],
        [1, 0],
        [0.5, 0.5],
      ]),
    ).not.toThrow();
  });
});
