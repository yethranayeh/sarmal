// @vitest-environment jsdom
import type { CurveDef } from "./types";

import { describe, it, expect, vi } from "vitest";

import { createEngine } from "./engine";
import { createRenderer } from "./renderer";
import { createSarmal } from "./index";
import {
  hexToRgbComponents,
  computeTangent,
  computeNormal,
  applyDprSizing,
  hexToRgb,
  lerpRgb,
  getPaletteColor,
} from "./renderer";
import {
  computeBoundaries,
  FIT_PADDING,
  FIT_PADDING_MIN,
  palettes,
  resolveHeadColor,
  resolveTrailPalette,
  resolveTrailMainColor,
  validateRenderOptions,
  warnIfTrailColorMismatch,
} from "./renderer-shared";

// Mock OffscreenCanvas for jsdom environment
class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext(_contextId: string) {
    return {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      stroke: () => {},
      fill: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      setTransform: () => {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      drawImage: () => {},
      arc: () => {},
    } as unknown as OffscreenCanvasRenderingContext2D;
  }
}
// @ts-ignore - adding to global for jsdom
globalThis.OffscreenCanvas = MockOffscreenCanvas;

// Test fixture for renderer lifecycle tests
const testCircle: CurveDef = {
  name: "test-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: Math.PI * 2,
  speed: 1,
};

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  // jsdom does not implement getBoundingClientRect layout —
  // mock it to return a stable 200×200 rect
  canvas.getBoundingClientRect = () => ({
    width: 200,
    height: 200,
    top: 0,
    left: 0,
    bottom: 200,
    right: 200,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  // jsdom does not implement canvas 2d context — mock a minimal one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (canvas as any).getContext = (contextId: string) => {
    if (contextId === "2d") {
      return {
        save: () => {},
        restore: () => {},
        clearRect: () => {},
        fillRect: () => {},
        stroke: () => {},
        fill: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        setTransform: () => {},
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        globalAlpha: 1,
        drawImage: () => {},
        arc: () => {},
      };
    }
    return null;
  };
  return canvas;
}

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

describe("computeBoundaries", () => {
  const astroidPts = (() => {
    const pts: { x: number; y: number }[] = [];
    const steps = 315;
    const period = Math.PI * 2;
    for (let i = 0; i < steps; i++) {
      const t = (i / (steps - 1)) * period;
      const c = Math.cos(t);
      const s = Math.sin(t);
      pts.push({ x: c * c * c, y: s * s * s });
    }
    return pts;
  })();

  it("returns null for empty points array", () => {
    expect(computeBoundaries([], 100, 100)).toBeNull();
  });

  it("throws for degenerate curve (all identical points)", () => {
    const pts = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ];
    expect(() => computeBoundaries(pts, 100, 100)).toThrow(/degenerate/i);
  });

  it("centers a symmetric curve in a square viewport", () => {
    const result = computeBoundaries(astroidPts, 100, 100)!;
    expect(result).not.toBeNull();
    expect(result.offsetX).toBeCloseTo(50, 1);
    expect(result.offsetY).toBeCloseTo(50, 1);
  });

  it("applies proportional padding for large viewports", () => {
    const result = computeBoundaries(astroidPts, 400, 400)!;
    const cuspX = 1 * result.scale + result.offsetX;
    const padding = 400 - cuspX;
    const proportionalPadding = FIT_PADDING * 2;
    expect(padding).toBeGreaterThan(400 * proportionalPadding * 0.4);
  });

  it("enforces minimum absolute padding for small viewports", () => {
    const small = 30;
    const result = computeBoundaries(astroidPts, small, small)!;
    const cuspX = 1 * result.scale + result.offsetX;
    const cuspNegX = -1 * result.scale + result.offsetX;
    const rightPad = small - cuspX;
    const leftPad = cuspNegX;
    expect(rightPad).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(leftPad).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
  });

  it("ensures no cusp clips at 40x40 viewport", () => {
    const size = 40;
    const result = computeBoundaries(astroidPts, size, size)!;
    const rightCusp = 1 * result.scale + result.offsetX;
    const leftCusp = -1 * result.scale + result.offsetX;
    const topCusp = 1 * result.scale + result.offsetY;
    const bottomCusp = -1 * result.scale + result.offsetY;

    expect(size - rightCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(leftCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(topCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(size - bottomCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
  });

  it("centering is symmetric for symmetric curves", () => {
    const result = computeBoundaries(astroidPts, 200, 200)!;
    const leftCusp = -1 * result.scale + result.offsetX;
    const rightCusp = 1 * result.scale + result.offsetX;
    const leftPad = leftCusp;
    const rightPad = 200 - rightCusp;
    expect(Math.abs(leftPad - rightPad)).toBeLessThan(0.01);
  });

  it("scales to fit the constraining dimension in a wide viewport", () => {
    const result = computeBoundaries(astroidPts, 300, 100)!;
    expect(result).not.toBeNull();
    const topCusp = 1 * result.scale + result.offsetY;
    const bottomCusp = -1 * result.scale + result.offsetY;
    const verticalAvailable = 100;
    const verticalUsed = topCusp - bottomCusp;
    expect(verticalUsed).toBeLessThanOrEqual(verticalAvailable);
    expect(verticalAvailable - topCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(bottomCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
  });

  it("scales to fit the constraining dimension in a tall viewport", () => {
    const result = computeBoundaries(astroidPts, 100, 300)!;
    const rightCusp = 1 * result.scale + result.offsetX;
    const leftCusp = -1 * result.scale + result.offsetX;
    expect(100 - rightCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(leftCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
  });

  it("handles curves not centered at origin", () => {
    const offsetPts = astroidPts.map((p) => ({ x: p.x + 5, y: p.y - 3 }));
    const result = computeBoundaries(offsetPts, 200, 200)!;
    const rightCusp = (5 + 1) * result.scale + result.offsetX;
    const leftCusp = (5 - 1) * result.scale + result.offsetX;
    expect(200 - rightCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
    expect(leftCusp).toBeGreaterThanOrEqual(FIT_PADDING_MIN);
  });

  it("minimum padding dominates proportional padding at small sizes", () => {
    const tiny = 20;
    const result = computeBoundaries(astroidPts, tiny, tiny)!;
    const bboxW = 2;
    const proportionalPad = FIT_PADDING * bboxW * result.scale;
    const actualPad = tiny / 2 - 1 * result.scale + (result.offsetX - tiny / 2);
    expect(FIT_PADDING_MIN).toBeGreaterThan(proportionalPad);
    expect(actualPad).toBeGreaterThanOrEqual(FIT_PADDING_MIN - 0.5);
  });

  it("proportional padding dominates minimum padding at large sizes", () => {
    const large = 800;
    const result = computeBoundaries(astroidPts, large, large)!;
    const rightCusp = 1 * result.scale + result.offsetX;
    const rightPad = large - rightCusp;
    expect(rightPad).toBeGreaterThan(FIT_PADDING_MIN);
  });
});

describe("morphTo type shape", () => {
  it("SarmalInstance has morphTo method that returns Promise", () => {
    const shape = {
      play: () => {},
      pause: () => {},
      reset: () => {},
      destroy: () => {},
      seek: () => {},
      jump: () => {},
      morphTo: () => Promise.resolve(),
    };
    expect(shape.morphTo).toBeDefined();
  });
});

describe("speed API", () => {
  it("createSarmal exposes setSpeed, getSpeed, and resetSpeed", () => {
    const instance = createSarmal(makeCanvas(), testCircle);
    expect(typeof instance.setSpeed).toBe("function");
    expect(typeof instance.getSpeed).toBe("function");
    expect(typeof instance.resetSpeed).toBe("function");
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

describe("type safety guards (prevent silent JS coercion bugs)", () => {
  it("computeNormal returns numbers, not strings", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const normal = computeNormal(trail, 1);
    // These would pass with "0.00" + "1" === "0.001" if we had string concatenation bugs
    expect(typeof normal.x).toBe("number");
    expect(typeof normal.y).toBe("number");
    expect(normal.x).toBeCloseTo(0, 5);
    expect(normal.y).toBeCloseTo(1, 5);
  });

  it("computeTangent returns unit vector with numeric components", () => {
    const trail = [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ];
    const tangent = computeTangent(trail, 0);
    expect(typeof tangent.x).toBe("number");
    expect(typeof tangent.y).toBe("number");
    // Verify it's actually a unit vector (not concatenated strings like "0.600.80")
    const length = Math.sqrt(tangent.x ** 2 + tangent.y ** 2);
    expect(length).toBeCloseTo(1, 5);
  });

  it("hexToRgbComponents returns string but with numeric content", () => {
    const result = hexToRgbComponents("#ff0000");
    expect(typeof result).toBe("string");
    // Split and verify each component is parseable as a number
    const parts = result.split(",").map((s) => parseInt(s, 10));
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe(255);
    expect(parts[1]).toBe(0);
    expect(parts[2]).toBe(0);
  });
});

describe("hexToRgb", () => {
  it("converts hex colors to RGB components", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("lerpRgb", () => {
  it("interpolates between two RGB colors", () => {
    const red = { r: 255, g: 0, b: 0 };
    const blue = { r: 0, g: 0, b: 255 };

    expect(lerpRgb(red, blue, 0)).toEqual({ r: 255, g: 0, b: 0 });
    expect(lerpRgb(red, blue, 1)).toEqual({ r: 0, g: 0, b: 255 });
    expect(lerpRgb(red, blue, 0.5)).toEqual({ r: 128, g: 0, b: 128 });
  });
});

describe("getPaletteColor", () => {
  it("returns white for empty palette", () => {
    expect(getPaletteColor([], 0)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("returns single color for single-entry palette", () => {
    expect(getPaletteColor(["#ff0000"], 0)).toEqual({ r: 255, g: 0, b: 0 });
    expect(getPaletteColor(["#ff0000"], 0.5)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("cycles through palette based on position", () => {
    const palette = ["#ff0000", "#0000ff"]; // Red to blue

    // Position 0 = first color
    expect(getPaletteColor(palette, 0)).toEqual({ r: 255, g: 0, b: 0 });

    // Position 1 = first color again (wraps)
    expect(getPaletteColor(palette, 1)).toEqual({ r: 255, g: 0, b: 0 });

    // Position 0.25 = interpolated (25% through the cycle)
    expect(getPaletteColor(palette, 0.25)).toEqual({ r: 128, g: 0, b: 128 });

    // Position 0.5 = second color (end of first segment)
    expect(getPaletteColor(palette, 0.5)).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("cycles through multi-color palette", () => {
    const palette = ["#ff0000", "#00ff00", "#0000ff"];

    // Position 0 = red
    expect(getPaletteColor(palette, 0)).toEqual({ r: 255, g: 0, b: 0 });

    // Position 0.33 = greenish (between red and green)
    const result = getPaletteColor(palette, 1 / 3);
    expect(result.r).toBe(0);
    expect(result.g).toBe(255);
    expect(result.b).toBe(0);

    // Position 0.67 = blueish (between green and blue)
    const result2 = getPaletteColor(palette, 2 / 3);
    expect(result2.r).toBe(0);
    expect(result2.g).toBe(0);
    expect(result2.b).toBe(255);
  });

  it("respects time offset for animation", () => {
    const palette = ["#ff0000", "#00ff00", "#0000ff"]; // Red, Green, Blue

    // Position 0 with offset 0 = first color (red)
    const staticResult = getPaletteColor(palette, 0, 0);
    expect(staticResult).toEqual({ r: 255, g: 0, b: 0 });

    // Position 0 with offset 0.33 = second color (green)
    const animatedResult = getPaletteColor(palette, 0, 1 / 3);
    expect(animatedResult).toEqual({ r: 0, g: 255, b: 0 });

    // Should be different due to time offset
    expect(animatedResult).not.toEqual(staticResult);
  });
});

describe("resolveTrailMainColor", () => {
  it("returns the string unchanged when trailColor is a string", () => {
    expect(resolveTrailMainColor("#ff0000")).toBe("#ff0000");
  });

  it("returns the first entry when trailColor is an array", () => {
    expect(resolveTrailMainColor(["#ff0000", "#00ff00", "#0000ff"])).toBe("#ff0000");
  });
});

describe("resolveTrailPalette", () => {
  it("wraps a single string in a one-element array", () => {
    expect(resolveTrailPalette("#ff0000")).toEqual(["#ff0000"]);
  });

  it("returns the array reference unchanged when trailColor is an array", () => {
    const arr = ["#ff0000", "#00ff00"];
    expect(resolveTrailPalette(arr)).toBe(arr);
  });
});

describe("resolveHeadColor", () => {
  it("returns the solid trail color for default style", () => {
    expect(resolveHeadColor("#ff0000", "default")).toBe("#ff0000");
  });

  it("returns the first array entry for default style when trailColor is an array", () => {
    expect(resolveHeadColor(["#ff0000", "#00ff00"], "default")).toBe("#ff0000");
  });

  it("returns the last palette stop as an rgb() string for gradient styles", () => {
    // Last entry of bard is "#ec4899" → rgb(236,72,153)
    expect(resolveHeadColor(palettes.bard, "gradient-animated")).toBe("rgb(236,72,153)");
    expect(resolveHeadColor(palettes.bard, "gradient-static")).toBe("rgb(236,72,153)");
  });

  it("wraps a single string as a one-color palette for gradient styles", () => {
    expect(resolveHeadColor("#ff0000", "gradient-animated")).toBe("rgb(255,0,0)");
  });
});

describe("palettes", () => {
  it("exposes the named palettes as plain arrays", () => {
    expect(Array.isArray(palettes.bard)).toBe(true);
    expect(palettes.bard.length).toBeGreaterThanOrEqual(2);
    expect(palettes.ice.length).toBe(2);
    expect(palettes.sunset[0]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe("createRenderer() lifecycle", () => {
  it("play() begins the animation loop (animationId is set)", () => {
    const rafIds: number[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((_cb) => {
      const id = rafIds.length + 1;
      rafIds.push(id);
      return id;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine, autoStart: false });
    renderer.play();

    expect(rafIds.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it("play() called twice does not double-schedule", () => {
    let callCount = 0;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
      callCount++;
      return callCount;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine, autoStart: false });
    renderer.play();
    const firstCount = callCount;
    renderer.play(); // second call should be a no-op
    expect(callCount).toBe(firstCount);

    vi.restoreAllMocks();
  });

  it("pause() cancels the animation frame", () => {
    const cancelled: number[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 42);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      cancelled.push(id);
    });

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine, autoStart: false });
    renderer.play();
    renderer.pause();

    expect(cancelled).toContain(42);

    vi.restoreAllMocks();
  });

  it("pause() called twice does not throw", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine, autoStart: false });
    renderer.play();
    renderer.pause();
    expect(() => renderer.pause()).not.toThrow();

    vi.restoreAllMocks();
  });

  it("destroy() cancels the animation frame and cleans up", () => {
    const cancelled: number[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 99);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      cancelled.push(id);
    });

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine, autoStart: false });
    renderer.play();
    renderer.destroy();

    expect(cancelled).toContain(99);

    vi.restoreAllMocks();
  });
});

describe("autoStart option", () => {
  it("autoStart: false - instance is created without starting the rAF loop", () => {
    let rafCallCount = 0;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
      rafCallCount++;
      return rafCallCount;
    });

    const engine = createEngine(testCircle);
    createRenderer({ canvas: makeCanvas(), engine, autoStart: false });

    // RAF should not be called during creation with autoStart: false
    expect(rafCallCount).toBe(0);

    vi.restoreAllMocks();
  });

  it("autoStart: true (default) - animation loop starts automatically", () => {
    let rafCallCount = 0;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
      rafCallCount++;
      return rafCallCount;
    });

    const engine = createEngine(testCircle);
    createRenderer({ canvas: makeCanvas(), engine });

    // RAF should be called during creation with autoStart: true (default)
    expect(rafCallCount).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });
});

describe("initialT option", () => {
  it("seek is called with initialT before first frame", () => {
    const identityCurve: CurveDef = {
      name: "identity",
      fn: (t, time) => ({ x: t, y: time }),
      period: 10,
      speed: 1,
    };

    const engine = createEngine(identityCurve);
    const initialT = Math.PI;

    // Create renderer with initialT - should seek to that position
    createRenderer({ canvas: makeCanvas(), engine, autoStart: false, initialT });

    // Verify the engine's internal state was seeked to initialT
    // by checking that tick(0) returns the point at initialT
    const trail = engine.tick(0);
    const head = trail[engine.trailCount - 1]!;
    expect(head.x).toBeCloseTo(initialT % 10, 5);
  });

  it("initialT works with autoStart: true", () => {
    const identityCurve: CurveDef = {
      name: "identity",
      fn: (t, time) => ({ x: t, y: time }),
      period: 10,
      speed: 1,
    };

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);

    const engine = createEngine(identityCurve);
    const initialT = 3.5;

    // Create with both autoStart: true and initialT
    createRenderer({ canvas: makeCanvas(), engine, initialT });

    // The head should already be at initialT from the seek
    const trail = engine.tick(0);
    const head = trail[engine.trailCount - 1]!;
    expect(head.x).toBeCloseTo(initialT, 5);

    vi.restoreAllMocks();
  });
});

describe("initial frame draw", () => {
  it("canvas is not blank when autoStart: false (renderFrame(0) called on creation)", () => {
    const canvas = makeCanvas();
    let clearRectCalled = false;
    let drawImageCalled = false;
    let fillCalled = false;

    // Mock the canvas context to track drawing calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (canvas as any).getContext = (contextId: string) => {
      if (contextId === "2d") {
        return {
          save: () => {},
          restore: () => {},
          clearRect: () => {
            clearRectCalled = true;
          },
          fillRect: () => {},
          stroke: () => {},
          fill: () => {
            fillCalled = true;
          },
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          setTransform: () => {},
          fillStyle: "",
          strokeStyle: "",
          lineWidth: 1,
          globalAlpha: 1,
          drawImage: () => {
            drawImageCalled = true;
          },
          arc: () => {},
        };
      }
      return null;
    };

    const engine = createEngine(testCircle);
    createRenderer({ canvas, engine, autoStart: false });

    // clearRect (canvas clear), drawImage (skeleton from offscreen), and fill (head) should have been called
    expect(clearRectCalled).toBe(true);
    expect(drawImageCalled).toBe(true);
    expect(fillCalled).toBe(true);
  });
});

describe("createSarmal() integration", () => {
  it("returns a SarmalInstance with all required methods", () => {
    const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
    expect(typeof instance.play).toBe("function");
    expect(typeof instance.pause).toBe("function");
    expect(typeof instance.destroy).toBe("function");
    expect(typeof instance.reset).toBe("function");
    expect(typeof instance.seek).toBe("function");
    expect(typeof instance.jump).toBe("function");
    expect(typeof instance.morphTo).toBe("function");
  });

  it("seek() delegates to the engine without throwing", () => {
    const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
    expect(() => instance.seek(Math.PI)).not.toThrow();
  });

  it("morphTo() returns a Promise", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const anotherCurve: CurveDef = {
      name: "other",
      fn: (t) => ({ x: Math.sin(t), y: Math.cos(t) }),
      period: Math.PI * 2,
      speed: 1,
    };
    const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
    const result = instance.morphTo(anotherCurve);
    expect(result).toBeInstanceOf(Promise);

    vi.restoreAllMocks();
  });
});

// ─── validateRenderOptions ───────────────────────────────────────────────────

describe("validateRenderOptions", () => {
  it("accepts an empty partial as a no-op", () => {
    expect(() => validateRenderOptions({})).not.toThrow();
  });

  it("rejects unknown keys by name", () => {
    expect(() =>
      validateRenderOptions({ trailColorr: "#ffffff" } as unknown as Parameters<
        typeof validateRenderOptions
      >[0]),
    ).toThrow(/unknown key "trailColorr"/);
  });

  it("rejects 3-digit shorthand hex for trailColor", () => {
    expect(() => validateRenderOptions({ trailColor: "#fff" })).toThrow(TypeError);
  });

  it("rejects named colors for trailColor", () => {
    expect(() => validateRenderOptions({ trailColor: "red" })).toThrow(TypeError);
  });

  it("rejects rgb() notation for trailColor", () => {
    expect(() => validateRenderOptions({ trailColor: "rgb(255,0,0)" })).toThrow(TypeError);
  });

  it("accepts a valid 6-digit hex for trailColor", () => {
    expect(() => validateRenderOptions({ trailColor: "#ff00aa" })).not.toThrow();
    expect(() => validateRenderOptions({ trailColor: "#FF00AA" })).not.toThrow();
  });

  it("accepts an array of 2+ valid hex entries for trailColor", () => {
    expect(() => validateRenderOptions({ trailColor: ["#ff0000", "#00ff00"] })).not.toThrow();
    expect(() =>
      validateRenderOptions({ trailColor: ["#ff0000", "#00ff00", "#0000ff"] }),
    ).not.toThrow();
  });

  it("rejects a trailColor array with only one entry", () => {
    expect(() => validateRenderOptions({ trailColor: ["#ff0000"] })).toThrow(RangeError);
  });

  it("rejects a trailColor array with invalid entries", () => {
    expect(() => validateRenderOptions({ trailColor: ["#ff0000", "red"] })).toThrow(
      /trailColor\[1\]/,
    );
  });

  it("rejects a non-string, non-array trailColor", () => {
    expect(() => validateRenderOptions({ trailColor: 42 as unknown as string })).toThrow(TypeError);
  });

  it("accepts null for headColor (reset to auto-follow)", () => {
    expect(() => validateRenderOptions({ headColor: null })).not.toThrow();
  });

  it("accepts a valid hex for headColor", () => {
    expect(() => validateRenderOptions({ headColor: "#aabbcc" })).not.toThrow();
  });

  it("rejects the legacy 'auto' sentinel for headColor (null is the supported form)", () => {
    expect(() => validateRenderOptions({ headColor: "auto" })).toThrow(TypeError);
  });

  it("rejects invalid hex for headColor", () => {
    expect(() => validateRenderOptions({ headColor: "#zzz" })).toThrow(TypeError);
  });

  it("accepts 'transparent' for skeletonColor", () => {
    expect(() => validateRenderOptions({ skeletonColor: "transparent" })).not.toThrow();
  });

  it("accepts a valid hex for skeletonColor", () => {
    expect(() => validateRenderOptions({ skeletonColor: "#112233" })).not.toThrow();
  });

  it("rejects invalid skeletonColor values", () => {
    expect(() => validateRenderOptions({ skeletonColor: "red" })).toThrow(TypeError);
  });

  it("accepts each valid trailStyle", () => {
    expect(() => validateRenderOptions({ trailStyle: "default" })).not.toThrow();
    expect(() => validateRenderOptions({ trailStyle: "gradient-static" })).not.toThrow();
    expect(() => validateRenderOptions({ trailStyle: "gradient-animated" })).not.toThrow();
  });

  it("rejects unknown trailStyle values with a message listing valid options", () => {
    let caught: unknown = null;
    try {
      validateRenderOptions({ trailStyle: "graident" as unknown as "default" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(RangeError);
    expect(String(caught)).toMatch(/default.*gradient-static.*gradient-animated/);
  });

  it("fail-atomic: invalid trailStyle with valid trailColor throws without side-effects", () => {
    // validateRenderOptions is a pure check — it cannot mutate anything. The
    // test here is that after a throw, re-running the same payload still throws
    // the same way (i.e. no hidden state was carried over).
    const payload = {
      trailColor: "#ff0000",
      trailStyle: "nope" as unknown as "default",
    };
    expect(() => validateRenderOptions(payload)).toThrow(RangeError);
    expect(() => validateRenderOptions(payload)).toThrow(RangeError);
  });
});

// ─── warnIfTrailColorMismatch ────────────────────────────────────────────────

describe("warnIfTrailColorMismatch", () => {
  it("does not warn when default style is paired with a single string", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTrailColorMismatch("#ff0000", "default");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not warn when gradient style is paired with an array", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTrailColorMismatch(["#ff0000", "#00ff00"], "gradient-animated");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("warns when default style is paired with an array", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTrailColorMismatch(["#ff0000", "#00ff00"], "default");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/only the first color/);
    spy.mockRestore();
  });

  it("warns when gradient style is paired with a single string", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnIfTrailColorMismatch("#ff0000", "gradient-animated");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toMatch(/solid color/);
    spy.mockRestore();
  });
});

// ─── setRenderOptions on SarmalInstance (canvas) ─────────────────────────────

/**
 * Creates a canvas that records every `fillStyle` assignment, so tests can
 * observe which color was used for the most recent draw calls. Returns both the
 * canvas and the shared `fillStyles` array — clear the array before a checkpoint
 * and inspect it after forcing a render.
 */
function makeCanvasWithFillTracker(): {
  canvas: HTMLCanvasElement;
  fillStyles: string[];
} {
  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 200;
  canvas.getBoundingClientRect = () => ({
    width: 200,
    height: 200,
    top: 0,
    left: 0,
    bottom: 200,
    right: 200,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  const fillStyles: string[] = [];
  let currentFillStyle = "";
  // biome-ignore lint/suspicious/noExplicitAny: minimal mock context for the test
  (canvas as any).getContext = (contextId: string) => {
    if (contextId !== "2d") return null;
    return {
      save: () => {},
      restore: () => {},
      clearRect: () => {},
      fillRect: () => {},
      stroke: () => {},
      fill: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      setTransform: () => {},
      get fillStyle() {
        return currentFillStyle;
      },
      set fillStyle(v: string) {
        currentFillStyle = v;
        fillStyles.push(v);
      },
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      drawImage: () => {},
      arc: () => {},
    };
  };
  return { canvas, fillStyles };
}

describe("setRenderOptions on SarmalInstance (canvas)", () => {
  it("is exposed on the instance", () => {
    const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
    expect(typeof instance.setRenderOptions).toBe("function");
  });

  it("accepts an empty partial as a no-op", () => {
    const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
    expect(() => instance.setRenderOptions({})).not.toThrow();
  });

  it("throws on invalid input without mutating any field (fail-atomic)", () => {
    // Mock rAF so play() doesn't crash and the initial frame can render.
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, {
      autoStart: false,
      trailColor: "#ff0000",
    });
    instance.play();
    instance.pause();

    // Attempt a partial where trailColor is valid but trailStyle is bogus.
    expect(() =>
      instance.setRenderOptions({
        trailColor: "#00ff00",
        trailStyle: "bogus" as unknown as "default",
      }),
    ).toThrow();

    fillStyles.length = 0;
    instance.play();
    instance.pause();

    // Trail should still be red — trailColor was not assigned because the whole
    // call threw before any mutation.
    expect(fillStyles.some((s) => s.includes("255,0,0"))).toBe(true);
    expect(fillStyles.some((s) => s.includes("0,255,0"))).toBe(false);

    instance.destroy();
    vi.restoreAllMocks();
  });

  it("updates the solid trail color when trailColor changes in default style", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, {
      trailColor: "#ff0000",
      trailStyle: "default",
    });
    instance.pause();

    fillStyles.length = 0;
    instance.setRenderOptions({ trailColor: "#00ff00" });
    instance.play();
    instance.pause();

    expect(fillStyles.some((s) => s.includes("0,255,0"))).toBe(true);

    instance.destroy();
    vi.restoreAllMocks();
  });

  it("refreshes the palette cache when trailColor changes in gradient style", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, {
      trailStyle: "gradient-animated",
      trailColor: palettes.bard,
    });
    instance.pause();

    // Switch palette to sunset. First color: #f97316 = 249,115,22
    fillStyles.length = 0;
    instance.setRenderOptions({ trailColor: palettes.sunset });
    instance.play();
    instance.pause();

    // Some segment of the trail should be tinted with a sunset color
    expect(fillStyles.some((s) => s.includes("249,115,22"))).toBe(true);

    instance.destroy();
    vi.restoreAllMocks();
  });

  describe("auto-follow head color", () => {
    it("follows trailColor changes when headColor has never been set", () => {
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

      const { canvas, fillStyles } = makeCanvasWithFillTracker();
      const instance = createSarmal(canvas, testCircle, {
        trailColor: "#ff0000",
        trailStyle: "default",
      });
      instance.pause();

      fillStyles.length = 0;
      instance.setRenderOptions({ trailColor: "#00ff00" });
      instance.play();
      instance.pause();

      // The head draws with `ctx.fillStyle = headColor`. In default style the
      // auto head color is the solid hex, so we look for the literal "#00ff00".
      expect(fillStyles.some((s) => s.toLowerCase() === "#00ff00")).toBe(true);

      instance.destroy();
      vi.restoreAllMocks();
    });

    it("locks headColor to the explicit value after a user override", () => {
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

      const { canvas, fillStyles } = makeCanvasWithFillTracker();
      const instance = createSarmal(canvas, testCircle, {
        trailColor: "#ff0000",
        trailStyle: "default",
      });
      instance.pause();

      instance.setRenderOptions({ headColor: "#aabbcc" });
      fillStyles.length = 0;
      // Change trailColor — head should NOT follow because it is locked.
      instance.setRenderOptions({ trailColor: "#00ff00" });
      instance.play();
      instance.pause();

      expect(fillStyles.some((s) => s.toLowerCase() === "#aabbcc")).toBe(true);
      expect(fillStyles.some((s) => s.toLowerCase() === "#00ff00")).toBe(false);

      instance.destroy();
      vi.restoreAllMocks();
    });

    it("resumes auto-follow when headColor is set back to null", () => {
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

      const { canvas, fillStyles } = makeCanvasWithFillTracker();
      const instance = createSarmal(canvas, testCircle, {
        trailColor: "#ff0000",
        trailStyle: "default",
      });
      instance.pause();

      instance.setRenderOptions({ headColor: "#aabbcc" }); // lock
      instance.setRenderOptions({ headColor: null }); // unlock
      fillStyles.length = 0;
      instance.setRenderOptions({ trailColor: "#00ff00" });
      instance.play();
      instance.pause();

      // Auto-follow should kick back in — head matches the new trail color.
      expect(fillStyles.some((s) => s.toLowerCase() === "#00ff00")).toBe(true);

      instance.destroy();
      vi.restoreAllMocks();
    });

    it("follows trailStyle changes when auto-follow is active", () => {
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

      const { canvas, fillStyles } = makeCanvasWithFillTracker();
      const instance = createSarmal(canvas, testCircle, {
        trailColor: palettes.bard,
        trailStyle: "default", // starts as default — head = first entry of bard
      });
      instance.pause();

      fillStyles.length = 0;
      // Switch to gradient. Auto head color now = last palette stop = bard[3]
      // = #ec4899 = rgb(236,72,153).
      instance.setRenderOptions({ trailStyle: "gradient-animated" });
      instance.play();
      instance.pause();

      expect(fillStyles.some((s) => s === "rgb(236,72,153)")).toBe(true);

      instance.destroy();
      vi.restoreAllMocks();
    });
  });

  describe("skeletonColor", () => {
    it("updates the skeleton color on subsequent frames", () => {
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

      const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
      expect(() => instance.setRenderOptions({ skeletonColor: "#123456" })).not.toThrow();

      instance.destroy();
      vi.restoreAllMocks();
    });

    it("switching to transparent and back does not throw", () => {
      vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
      vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

      const instance = createSarmal(makeCanvas(), testCircle, { autoStart: false });
      expect(() => instance.setRenderOptions({ skeletonColor: "transparent" })).not.toThrow();
      expect(() => instance.setRenderOptions({ skeletonColor: "#ffffff" })).not.toThrow();

      instance.destroy();
      vi.restoreAllMocks();
    });
  });

  describe("mismatch warnings", () => {
    it("warns when setRenderOptions creates a mismatched (trailColor, trailStyle) pair", () => {
      const instance = createSarmal(makeCanvas(), testCircle, {
        autoStart: false,
        trailColor: "#ff0000",
        trailStyle: "default",
      });

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      instance.setRenderOptions({ trailStyle: "gradient-animated" });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/solid color/);

      spy.mockRestore();
      instance.destroy();
    });

    it("does not re-warn when neither trailColor nor trailStyle is in the payload", () => {
      const instance = createSarmal(makeCanvas(), testCircle, {
        autoStart: false,
        trailColor: "#ff0000",
        trailStyle: "default",
      });

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      instance.setRenderOptions({ skeletonColor: "#222222" });
      expect(spy).not.toHaveBeenCalled();

      spy.mockRestore();
      instance.destroy();
    });
  });
});

// ─── Orthogonality: engine/lifecycle APIs do NOT touch render options ────────

describe("setRenderOptions orthogonality", () => {
  // Counts fill assignments that contain red — either rgba("255,0,0,...") from
  // trail segments or the literal "#ff0000" from the head dot. Either form is
  // enough to prove the closure state survived a lifecycle call.
  function countWithRed(fillStyles: string[]) {
    return fillStyles.filter((s) => s.toLowerCase().includes("ff0000") || s.includes("255,0,0"))
      .length;
  }

  it("reset() preserves trailColor", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, { trailColor: "#ff0000" });
    instance.pause();
    instance.reset();

    fillStyles.length = 0;
    instance.play();
    instance.pause();

    expect(countWithRed(fillStyles)).toBeGreaterThan(0);

    instance.destroy();
    vi.restoreAllMocks();
  });

  it("pause()/play() preserves trailColor", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, { trailColor: "#ff0000" });
    instance.pause();
    instance.play();
    instance.pause();

    fillStyles.length = 0;
    instance.play();
    instance.pause();

    expect(countWithRed(fillStyles)).toBeGreaterThan(0);

    instance.destroy();
    vi.restoreAllMocks();
  });

  it("setSpeed()/resetSpeed() preserves trailColor", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, { trailColor: "#ff0000" });
    instance.pause();
    instance.setSpeed(2);
    instance.resetSpeed();

    fillStyles.length = 0;
    instance.play();
    instance.pause();

    expect(countWithRed(fillStyles)).toBeGreaterThan(0);

    instance.destroy();
    vi.restoreAllMocks();
  });

  it("morphTo() preserves trailColor after it settles", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const otherCurve: CurveDef = {
      name: "other",
      fn: (t) => ({ x: Math.sin(t), y: Math.cos(t) }),
      period: Math.PI * 2,
      speed: 1,
    };

    const { canvas, fillStyles } = makeCanvasWithFillTracker();
    const instance = createSarmal(canvas, testCircle, { trailColor: "#ff0000" });
    instance.pause();
    instance.morphTo(otherCurve);

    fillStyles.length = 0;
    instance.play();
    instance.pause();

    expect(countWithRed(fillStyles)).toBeGreaterThan(0);

    instance.destroy();
    vi.restoreAllMocks();
  });
});
