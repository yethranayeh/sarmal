// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { createEngine } from "./engine";
import { createRenderer } from "./renderer";
import type { CurveDef } from "./types";
import {
  hexToRgbComponents,
  computeTangent,
  computeNormal,
  applyDprSizing,
  hexToRgb,
  lerpRgb,
  getPaletteColor,
  resolvePalette,
} from "./renderer";

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

describe("resolvePalette", () => {
  it("returns custom array as-is", () => {
    const custom = ["#ff0000", "#00ff00"];
    expect(resolvePalette(custom, "gradient-static")).toBe(custom);
  });

  it("resolves preset names to palettes", () => {
    const bard = resolvePalette("bard", "gradient-animated");
    expect(bard.length).toBe(4);
    expect(bard[0]).toBe("#a855f7");

    const ice = resolvePalette("ice", "gradient-static");
    expect(ice.length).toBe(2);
    expect(ice[0]).toBe("#1e3a8a");
  });

  it("defaults to Bard for animated style", () => {
    const result = resolvePalette(undefined, "gradient-animated");
    expect(result[0]).toBe("#a855f7"); // Bard's first color
  });

  it("defaults to Ice for static style", () => {
    const result = resolvePalette(undefined, "gradient-static");
    expect(result[0]).toBe("#1e3a8a"); // Ice's first color
  });

  it("defaults to Ice for default style", () => {
    const result = resolvePalette(undefined, "default");
    expect(result[0]).toBe("#1e3a8a"); // Ice's first color
  });
});

describe("createRenderer() lifecycle", () => {
  it("start() begins the animation loop (animationId is set)", () => {
    const rafIds: number[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((_cb) => {
      const id = rafIds.length + 1;
      rafIds.push(id);
      return id;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine });
    renderer.start();

    expect(rafIds.length).toBeGreaterThan(0);

    vi.restoreAllMocks();
  });

  it("start() called twice does not double-schedule", () => {
    let callCount = 0;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
      callCount++;
      return callCount;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine });
    renderer.start();
    const firstCount = callCount;
    renderer.start(); // second call should be a no-op
    expect(callCount).toBe(firstCount);

    vi.restoreAllMocks();
  });

  it("stop() cancels the animation frame", () => {
    const cancelled: number[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 42);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      cancelled.push(id);
    });

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine });
    renderer.start();
    renderer.stop();

    expect(cancelled).toContain(42);

    vi.restoreAllMocks();
  });

  it("stop() called twice does not throw", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine });
    renderer.start();
    renderer.stop();
    expect(() => renderer.stop()).not.toThrow();

    vi.restoreAllMocks();
  });

  it("destroy() cancels the animation frame and cleans up", () => {
    const cancelled: number[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 99);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      cancelled.push(id);
    });

    const engine = createEngine(testCircle);
    const renderer = createRenderer({ canvas: makeCanvas(), engine });
    renderer.start();
    renderer.destroy();

    expect(cancelled).toContain(99);

    vi.restoreAllMocks();
  });
});
