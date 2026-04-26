import { describe, it, expect } from "vitest";
import { createSplineCurve } from "./spline";

describe("createSplineCurve", () => {
  it("should throw if less than 2 points are provided", () => {
    expect(() => createSplineCurve([{ x: 0, y: 0 }])).toThrow();
  });

  it("should evaluate at start and end for closed curves", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const curve = createSplineCurve(points, { closed: true });
    
    // Period start should be roughly the first point
    const pStart = curve.fn(0, 0, {});
    expect(pStart.x).toBeCloseTo(0);
    expect(pStart.y).toBeCloseTo(0);

    // Period end should wrap back to the first point
    const pEnd = curve.fn(curve.period!, 0, {});
    expect(pEnd.x).toBeCloseTo(0);
    expect(pEnd.y).toBeCloseTo(0);
  });

  it("should evaluate correctly for open curves", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const curve = createSplineCurve(points, { closed: false });
    
    const pStart = curve.fn(0, 0, {});
    expect(pStart.x).toBeCloseTo(0);
    expect(pStart.y).toBeCloseTo(0);

    const pEnd = curve.fn(curve.period!, 0, {});
    expect(pEnd.x).toBeCloseTo(10);
    expect(pEnd.y).toBeCloseTo(0);
  });
});
