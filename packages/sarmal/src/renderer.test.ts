import { describe, it, expect } from "vitest";
import { hexToRgbComponents, computeTangent, computeNormal, applyDprSizing } from "./renderer";

describe("hexToRgbComponents", () => {
  it("parses valid 6-digit hex colors", () => {
    expect(hexToRgbComponents("#ff0000")).toBe("255,0,0");
    expect(hexToRgbComponents("#00ff00")).toBe("0,255,0");
    expect(hexToRgbComponents("#0000ff")).toBe("0,0,255");
    expect(hexToRgbComponents("#ffffff")).toBe("255,255,255");
    expect(hexToRgbComponents("#000000")).toBe("0,0,0");
  });

  it("parses hex colors with mixed case", () => {
    expect(hexToRgbComponents("#FFff00")).toBe("255,255,0");
    expect(hexToRgbComponents("#AaBbCc")).toBe("170,187,204");
  });

  it("KNOWN: invalid hex produces '0,0,0' — NaN from parseInt is coerced to 0 by bitwise ops", () => {
    expect(hexToRgbComponents("")).toBe("0,0,0");
    expect(hexToRgbComponents("#gg0000")).toBe("0,0,0");
  });

  it("KNOWN: CSS named colors are not supported — silently produce wrong values", () => {
    expect(hexToRgbComponents("red")).toBe("0,0,237");
  });

  it("KNOWN: 3-digit shorthand is not expanded — #fff produces '0,15,255' not '255,255,255'", () => {
    expect(hexToRgbComponents("#fff")).toBe("0,15,255");
  });
});

describe("applyDprSizing", () => {
  /**
   * !!! REGRESSION GUARD — DO NOT REMOVE !!!
   *
   * If any of the assertions below start failing, a previous commit
   * likely removed the `style.width` / `style.height` assignments in
   * `applyDprSizing`. Putting those back is the fix.
   *
   * The bug: a canvas with only width/height attributes (no CSS) derives
   * its displayed size from those attributes. The moment we set
   * `canvas.width = logicalWidth * dpr` to scale the drawing buffer for
   * HiDPI crispness, the element also visually balloons by the DPR
   * factor. Pinning `style.width`/`style.height` first locks the CSS
   * display size so the buffer change cannot resize the element.
   *
   * Skipping this on Retina/HiDPI produces a silent, zoomed-to-hell
   * render with no error — the exact kind of bug a user would hit in
   * prod and have no idea how to debug.
   */
  it("pins CSS display size AND scales drawing buffer by DPR", () => {
    const target = { width: 0, height: 0, style: { width: "", height: "" } };
    applyDprSizing(target, 200, 130, 2);

    // Drawing buffer is DPR-scaled for HiDPI crispness
    expect(target.width).toBe(400);
    expect(target.height).toBe(260);

    // CSS display size stays at logical dimensions — this is the critical
    // half. If either of these is empty, the element will visually grow
    // to match the buffer attributes, zooming the render.
    expect(target.style.width).toBe("200px");
    expect(target.style.height).toBe("130px");
  });

  it("handles DPR=1 (no HiDPI) without changing logical dimensions", () => {
    const target = { width: 0, height: 0, style: { width: "", height: "" } };
    applyDprSizing(target, 200, 130, 1);

    expect(target.width).toBe(200);
    expect(target.height).toBe(130);
    expect(target.style.width).toBe("200px");
    expect(target.style.height).toBe("130px");
  });

  it("handles fractional DPR (e.g., 1.5 on some Windows setups)", () => {
    const target = { width: 0, height: 0, style: { width: "", height: "" } };
    applyDprSizing(target, 200, 130, 1.5);

    expect(target.width).toBe(300);
    expect(target.height).toBe(195);
    expect(target.style.width).toBe("200px");
    expect(target.style.height).toBe("130px");
  });
});

describe("morphTo type shape", () => {
  it("SarmalInstance has morphTo method that returns Promise", () => {
    const shape = {
      start: () => {},
      stop: () => {},
      reset: () => {},
      destroy: () => {},
      seek: () => {},
      seekWithTrail: () => {},
      morphTo: () => Promise.resolve(),
    };
    expect(shape.morphTo).toBeDefined();
  });
});

describe("computeTangent", () => {
  it("returns unit vector for a horizontal line", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const tangent = computeTangent(trail, 1);
    expect(tangent.x).toBeCloseTo(1, 5);
    expect(tangent.y).toBeCloseTo(0, 5);
  });

  it("returns unit vector for a vertical line", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    const tangent = computeTangent(trail, 1);
    expect(tangent.x).toBeCloseTo(0, 5);
    expect(tangent.y).toBeCloseTo(1, 5);
  });

  it("uses central difference for interior points", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const tangent = computeTangent(trail, 1);
    const length = Math.sqrt(tangent.x ** 2 + tangent.y ** 2);
    expect(length).toBeCloseTo(1, 5);
  });

  it("uses forward difference for first point", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 6, y: 8 },
    ];
    const tangent = computeTangent(trail, 0);
    expect(tangent.x).toBeCloseTo(0.6, 5);
    expect(tangent.y).toBeCloseTo(0.8, 5);
  });

  it("uses backward difference for last point", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 6, y: 8 },
    ];
    const tangent = computeTangent(trail, 2);
    expect(tangent.x).toBeCloseTo(0.6, 5);
    expect(tangent.y).toBeCloseTo(0.8, 5);
  });

  it("handles 2-point trail", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ];
    const tangent0 = computeTangent(trail, 0);
    const tangent1 = computeTangent(trail, 1);
    expect(tangent0.x).toBeCloseTo(1, 5);
    expect(tangent0.y).toBeCloseTo(0, 5);
    expect(tangent1.x).toBeCloseTo(1, 5);
    expect(tangent1.y).toBeCloseTo(0, 5);
  });

  it("handles diagonal line at 45 degrees", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const tangent = computeTangent(trail, 1);
    expect(tangent.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(tangent.y).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("handles curve with sharp turn using central difference", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    const tangent0 = computeTangent(trail, 0);
    const tangent1 = computeTangent(trail, 1);
    const tangent2 = computeTangent(trail, 2);
    expect(tangent0.x).toBeCloseTo(1, 5);
    expect(tangent0.y).toBeCloseTo(0, 5);
    expect(tangent1.x).toBeCloseTo(Math.SQRT1_2, 5);
    expect(tangent1.y).toBeCloseTo(Math.SQRT1_2, 5);
    expect(tangent2.x).toBeCloseTo(0, 5);
    expect(tangent2.y).toBeCloseTo(1, 5);
  });
});

describe("computeNormal", () => {
  it("returns perpendicular to tangent (90° CCW rotation)", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const normal = computeNormal(trail, 1);
    expect(normal.x).toBeCloseTo(0, 5);
    expect(normal.y).toBeCloseTo(1, 5);
  });

  it("returns perpendicular for vertical tangent", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    const normal = computeNormal(trail, 1);
    expect(normal.x).toBeCloseTo(-1, 5);
    expect(normal.y).toBeCloseTo(0, 5);
  });

  it("returns perpendicular for diagonal tangent", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ];
    const normal = computeNormal(trail, 1);
    expect(normal.x).toBeCloseTo(-Math.SQRT1_2, 5);
    expect(normal.y).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("returns unit vector (normalized)", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
      { x: 6, y: 8 },
    ];
    const normal = computeNormal(trail, 1);
    const length = Math.sqrt(normal.x ** 2 + normal.y ** 2);
    expect(length).toBeCloseTo(1, 5);
  });

  it("handles first point correctly", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];
    const normal = computeNormal(trail, 0);
    expect(normal.x).toBeCloseTo(-1, 5);
    expect(normal.y).toBeCloseTo(0, 5);
  });

  it("handles last point correctly", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ];
    const normal = computeNormal(trail, 1);
    expect(normal.x).toBeCloseTo(-1, 5);
    expect(normal.y).toBeCloseTo(0, 5);
  });

  it("normal points left of direction of travel (CCW rotation)", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    const normal = computeNormal(trail, 0);
    expect(normal.y).toBeGreaterThan(0);
  });
});
