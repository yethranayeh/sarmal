import type { CurveDef } from "@sarmal/core";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  shallowEqualTrailColor,
  initValuesEqual,
  canvasInitValuesEqual,
  dotMatrixInitValuesEqual,
  extractRuntimeOptions,
  resolveCanvasSize,
} from "./utils";

const circle: CurveDef = {
  name: "test-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: Math.PI * 2,
  speed: 1,
};

const square: CurveDef = {
  name: "test-square",
  fn: (t) => ({ x: Math.cos(t) * 0.5, y: Math.sin(t) * 0.5 }),
  period: Math.PI * 2,
  speed: 1,
};

const mockInstance = {
  play: vi.fn(),
  pause: vi.fn(),
  reset: vi.fn(),
  destroy: vi.fn(),
  morphTo: vi.fn(() => Promise.resolve()),
  setRenderOptions: vi.fn(),
};

vi.mock("@sarmal/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sarmal/core")>();
  return {
    ...actual,
    createSarmal: vi.fn(() => mockInstance),
    createSarmalSVG: vi.fn(() => mockInstance),
    createSarmalDotMatrix: vi.fn(() => mockInstance),
  };
});

import { createSarmal, createSarmalSVG, createSarmalDotMatrix } from "@sarmal/core";
const mockCreateSarmal = vi.mocked(createSarmal);
const mockCreateSarmalSVG = vi.mocked(createSarmalSVG);
const mockCreateSarmalDotMatrix = vi.mocked(createSarmalDotMatrix);

import { sarmal } from "./sarmal";
import { sarmalSVG } from "./sarmal-svg";
import { sarmalDotMatrix } from "./sarmal-dot-matrix";

// ─── shallowEqualTrailColor ──────────────────────────────────────────────────

describe("shallowEqualTrailColor", () => {
  it("returns true for identical string references", () => {
    expect(shallowEqualTrailColor("#ffffff", "#ffffff")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(shallowEqualTrailColor("#ffffff", "#000000")).toBe(false);
  });

  it("returns true for undefined vs undefined", () => {
    expect(shallowEqualTrailColor(undefined, undefined)).toBe(true);
  });

  it("returns false for string vs undefined", () => {
    expect(shallowEqualTrailColor("#ffffff", undefined)).toBe(false);
  });

  it("returns true for equal arrays", () => {
    expect(shallowEqualTrailColor(["#ff0000", "#00ff00"], ["#ff0000", "#00ff00"])).toBe(true);
  });

  it("returns false for different arrays", () => {
    expect(shallowEqualTrailColor(["#ff0000", "#00ff00"], ["#0000ff", "#ff00ff"])).toBe(false);
  });

  it("returns false for arrays of different length", () => {
    expect(shallowEqualTrailColor(["#ff0000"], ["#ff0000", "#00ff00"])).toBe(false);
  });

  it("returns false for string vs array", () => {
    expect(shallowEqualTrailColor("#ffffff", ["#ffffff"])).toBe(false);
  });
});

// ─── initValuesEqual ─────────────────────────────────────────────────────────

describe("initValuesEqual", () => {
  it("returns true for identical references", () => {
    const a = { trailLength: 120 };
    expect(initValuesEqual(a, a)).toBe(true);
  });

  it("returns true for undefined vs undefined", () => {
    expect(initValuesEqual(undefined, undefined)).toBe(true);
  });

  it("returns false for object vs undefined", () => {
    expect(initValuesEqual({ trailLength: 120 }, undefined)).toBe(false);
  });

  it("returns false for undefined vs object", () => {
    expect(initValuesEqual(undefined, { trailLength: 120 })).toBe(false);
  });

  it("returns true when all init fields match", () => {
    expect(
      initValuesEqual(
        { trailLength: 120, headRadius: 4, autoStart: true, initialPhase: 0, pauseOnHidden: false },
        { trailLength: 120, headRadius: 4, autoStart: true, initialPhase: 0, pauseOnHidden: false },
      ),
    ).toBe(true);
  });

  it("returns false when trailLength differs", () => {
    expect(initValuesEqual({ trailLength: 120 }, { trailLength: 200 })).toBe(false);
  });

  it("returns false when headRadius differs", () => {
    expect(initValuesEqual({ headRadius: 4 }, { headRadius: 10 })).toBe(false);
  });

  it("returns false when autoStart differs", () => {
    expect(initValuesEqual({ autoStart: true }, { autoStart: false })).toBe(false);
  });

  it("returns false when initialPhase differs", () => {
    expect(initValuesEqual({ initialPhase: 0 }, { initialPhase: 1 })).toBe(false);
  });

  it("returns false when pauseOnHidden differs", () => {
    expect(initValuesEqual({ pauseOnHidden: true }, { pauseOnHidden: false })).toBe(false);
  });

  it("treats pauseOnHidden undefined vs false as different", () => {
    expect(initValuesEqual({}, { pauseOnHidden: false })).toBe(false);
  });

  it("ignores extra properties", () => {
    expect(
      initValuesEqual(
        { trailLength: 120, width: 300 } as never,
        { trailLength: 120, height: 300 } as never,
      ),
    ).toBe(true);
  });
});

// ─── canvasInitValuesEqual ───────────────────────────────────────────────────

describe("canvasInitValuesEqual", () => {
  it("returns true when all fields including width/height match", () => {
    expect(
      canvasInitValuesEqual(
        {
          trailLength: 120,
          headRadius: 4,
          autoStart: true,
          initialPhase: 0,
          width: 300,
          height: 300,
        },
        {
          trailLength: 120,
          headRadius: 4,
          autoStart: true,
          initialPhase: 0,
          width: 300,
          height: 300,
        },
      ),
    ).toBe(true);
  });

  it("returns false when width differs", () => {
    expect(canvasInitValuesEqual({ width: 300, height: 300 }, { width: 400, height: 300 })).toBe(
      false,
    );
  });

  it("returns false when height differs", () => {
    expect(canvasInitValuesEqual({ width: 300, height: 300 }, { width: 300, height: 400 })).toBe(
      false,
    );
  });

  it("delegates init field comparisons", () => {
    expect(
      canvasInitValuesEqual(
        { trailLength: 120, width: 300, height: 300 },
        { trailLength: 200, width: 300, height: 300 },
      ),
    ).toBe(false);
  });

  it("delegates pauseOnHidden comparison", () => {
    expect(
      canvasInitValuesEqual(
        { pauseOnHidden: true, width: 300, height: 300 },
        { pauseOnHidden: false, width: 300, height: 300 },
      ),
    ).toBe(false);
  });

  it("returns true for both undefined", () => {
    expect(canvasInitValuesEqual(undefined, undefined)).toBe(true);
  });
});

// ─── dotMatrixInitValuesEqual ────────────────────────────────────────────────

describe("dotMatrixInitValuesEqual", () => {
  it("returns true for identical references", () => {
    const a = { cols: 16, rows: 16 };
    expect(dotMatrixInitValuesEqual(a, a)).toBe(true);
  });

  it("returns true for undefined vs undefined", () => {
    expect(dotMatrixInitValuesEqual(undefined, undefined)).toBe(true);
  });

  it("returns false for object vs undefined", () => {
    expect(dotMatrixInitValuesEqual({ cols: 16, rows: 16 }, undefined)).toBe(false);
  });

  it("returns false for undefined vs object", () => {
    expect(dotMatrixInitValuesEqual(undefined, { cols: 16, rows: 16 })).toBe(false);
  });

  it("returns false when cols differs", () => {
    expect(dotMatrixInitValuesEqual({ cols: 16 }, { cols: 32 })).toBe(false);
  });

  it("returns false when rows differs", () => {
    expect(dotMatrixInitValuesEqual({ rows: 16 }, { rows: 32 })).toBe(false);
  });

  it("returns false when roundness differs", () => {
    expect(dotMatrixInitValuesEqual({ roundness: 0 }, { roundness: 1 })).toBe(false);
  });

  it("returns false when trailLength differs", () => {
    expect(dotMatrixInitValuesEqual({ trailLength: 60 }, { trailLength: 120 })).toBe(false);
  });

  it("returns false when autoStart differs", () => {
    expect(dotMatrixInitValuesEqual({ autoStart: true }, { autoStart: false })).toBe(false);
  });

  it("returns false when initialPhase differs", () => {
    expect(dotMatrixInitValuesEqual({ initialPhase: 0 }, { initialPhase: 1 })).toBe(false);
  });

  it("returns false when pauseOnHidden differs", () => {
    expect(dotMatrixInitValuesEqual({ pauseOnHidden: true }, { pauseOnHidden: false })).toBe(false);
  });

  it("returns false when width differs", () => {
    expect(dotMatrixInitValuesEqual({ width: 300, height: 300 }, { width: 400, height: 300 })).toBe(
      false,
    );
  });

  it("returns false when height differs", () => {
    expect(dotMatrixInitValuesEqual({ width: 300, height: 300 }, { width: 300, height: 400 })).toBe(
      false,
    );
  });

  it("returns true when all fields match", () => {
    const opts = {
      cols: 16,
      rows: 16,
      roundness: 0.5,
      trailLength: 60,
      autoStart: true,
      initialPhase: 0,
      pauseOnHidden: false,
      width: 300,
      height: 300,
    };
    expect(dotMatrixInitValuesEqual(opts, { ...opts })).toBe(true);
  });
});

// ─── extractRuntimeOptions ───────────────────────────────────────────────────

describe("extractRuntimeOptions", () => {
  it("extracts trailColor", () => {
    expect(extractRuntimeOptions({ trailColor: "#ff0000" })).toEqual({ trailColor: "#ff0000" });
  });

  it("extracts skeletonColor", () => {
    expect(extractRuntimeOptions({ skeletonColor: "#ffffff" })).toEqual({
      skeletonColor: "#ffffff",
    });
  });

  it("extracts headColor", () => {
    expect(extractRuntimeOptions({ headColor: "#00ff00" })).toEqual({ headColor: "#00ff00" });
  });

  it("extracts null headColor as null", () => {
    expect(extractRuntimeOptions({ headColor: null as never })).toEqual({ headColor: null });
  });

  it("extracts trailStyle", () => {
    expect(extractRuntimeOptions({ trailStyle: "gradient-animated" })).toEqual({
      trailStyle: "gradient-animated",
    });
  });

  it("extracts trailWidth", () => {
    expect(extractRuntimeOptions({ trailWidth: 2 })).toEqual({ trailWidth: 2 });
  });

  it("omits undefined values", () => {
    expect(extractRuntimeOptions({})).toEqual({});
  });

  it("extracts multiple options at once", () => {
    expect(
      extractRuntimeOptions({
        trailColor: "#ff0000",
        skeletonColor: "#00ff00",
        headColor: "#0000ff",
        trailStyle: "gradient-static",
        trailWidth: 1.5,
      }),
    ).toEqual({
      trailColor: "#ff0000",
      skeletonColor: "#00ff00",
      headColor: "#0000ff",
      trailStyle: "gradient-static",
      trailWidth: 1.5,
    });
  });

  it("does not include unrecognised keys", () => {
    const result = extractRuntimeOptions({ trailLength: 120 } as never);
    expect(result).toEqual({});
  });
});

// ─── sarmal (canvas action) ──────────────────────────────────────────────────

describe("sarmal (canvas action)", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    canvas = document.createElement("canvas");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createAction(opts: Parameters<typeof sarmal>[1]) {
    return sarmal(canvas, opts);
  }

  it("creates a sarmal instance on mount", () => {
    createAction({ curve: circle });

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, expect.any(Object));
  });

  it("calls destroy when action is destroyed", () => {
    const action = createAction({ curve: circle });

    action.destroy!();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("morphs when curve changes in update", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square });

    expect(mockInstance.morphTo).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {});
  });

  it("forwards morphDuration when curve changes with duration", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphDuration: 500 });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, { duration: 500 });
  });

  it("forwards morphStrategy when curve changes", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphStrategy: "raw" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, { morphStrategy: "raw" });
  });

  it("forwards both morphDuration and morphStrategy when curve changes", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphDuration: 300, morphStrategy: "raw" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 300,
      morphStrategy: "raw",
    });
  });

  it("calls setRenderOptions when trailColor changes", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: circle, trailColor: "#00ff00" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#00ff00" });
  });

  it("calls setRenderOptions when skeletonColor changes", () => {
    const action = createAction({ curve: circle, skeletonColor: "#ffffff" });

    action.update!({ curve: circle, skeletonColor: "transparent" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ skeletonColor: "transparent" });
  });

  it("calls setRenderOptions when headColor changes", () => {
    const action = createAction({ curve: circle, headColor: "#ffffff" });

    action.update!({ curve: circle, headColor: "#ff0000" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ headColor: "#ff0000" });
  });

  it("calls setRenderOptions with null when headColor is removed", () => {
    const action = createAction({ curve: circle, headColor: "#ffffff" });

    action.update!({ curve: circle });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ headColor: null });
  });

  it("calls setRenderOptions when trailStyle changes", () => {
    const action = createAction({ curve: circle, trailStyle: "default" });

    action.update!({ curve: circle, trailStyle: "gradient-animated" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailStyle: "gradient-animated" });
  });

  it("calls setRenderOptions when trailWidth changes", () => {
    const action = createAction({ curve: circle, trailWidth: 1 });

    action.update!({ curve: circle, trailWidth: 2 });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailWidth: 2 });
  });

  it("destroys and recreates when trailLength changes", () => {
    const action = createAction({ curve: circle, trailLength: 60 });

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailLength: 200 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when headRadius changes", () => {
    const action = createAction({ curve: circle, headRadius: 4 });

    action.update!({ curve: circle, headRadius: 10 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when autoStart changes", () => {
    const action = createAction({ curve: circle, autoStart: true });

    action.update!({ curve: circle, autoStart: false });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when initialPhase changes", () => {
    const action = createAction({ curve: circle, initialPhase: 0 });

    action.update!({ curve: circle, initialPhase: 0.5 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when pauseOnHidden changes", () => {
    const action = createAction({ curve: circle, pauseOnHidden: true });

    action.update!({ curve: circle, pauseOnHidden: false });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("does not recreate when runtime visual options change", () => {
    const action = createAction({ curve: circle });
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailColor: "#00ff00" });

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
    expect(mockInstance.destroy).not.toHaveBeenCalled();
  });

  it("does not recreate when curve changes (morphs instead)", () => {
    const action = createAction({ curve: circle });
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    action.update!({ curve: square });

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
    expect(mockInstance.destroy).not.toHaveBeenCalled();
    expect(mockInstance.morphTo).toHaveBeenCalled();
  });

  it("applies both curve morph and render option changes in the same update", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: square, trailColor: "#00ff00" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {});
    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#00ff00" });
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
  });

  it("uses shallow comparison for trailColor arrays", () => {
    const colors = ["#ff0000", "#00ff00"];
    const action = createAction({ curve: circle, trailColor: colors });

    action.update!({ curve: circle, trailColor: [...colors] });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("calls setRenderOptions when trailColor array content changes", () => {
    const action = createAction({ curve: circle, trailColor: ["#ff0000", "#00ff00"] });

    action.update!({ curve: circle, trailColor: ["#0000ff", "#ff00ff"] });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: ["#0000ff", "#ff00ff"],
    });
  });

  it("does not call setRenderOptions when trailColor is removed", () => {
    // Removing trailColor (going to undefined) is a silent drop — the action
    // cannot clear a color back to its default through setRenderOptions.
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: circle });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("does not call setRenderOptions when skeletonColor is removed", () => {
    const action = createAction({ curve: circle, skeletonColor: "#ffffff" });

    action.update!({ curve: circle });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("swallows morphTo rejection", async () => {
    mockInstance.morphTo.mockRejectedValueOnce(new Error("Instance destroyed during morph"));
    const action = createAction({ curve: circle });

    // should not throw or produce an unhandled rejection
    action.update!({ curve: square });
  });

  it("tracks prevOpts correctly after recreate so subsequent updates diff from new baseline", () => {
    const action = createAction({ curve: circle, trailLength: 60 });
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    // trigger recreate
    action.update!({ curve: circle, trailLength: 200 });
    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);

    // trailLength is now 200 in prevOpts; this update should NOT recreate again
    action.update!({ curve: circle, trailLength: 200, trailColor: "#ff0000" });
    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#ff0000" });
  });

  it("passes trailLength to createSarmal", () => {
    createAction({ curve: circle, trailLength: 60 });

    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      trailLength: 60,
    });
  });

  it("passes headRadius to createSarmal", () => {
    createAction({ curve: circle, headRadius: 10 });

    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      headRadius: 10,
    });
  });

  it("passes autoStart to createSarmal", () => {
    createAction({ curve: circle, autoStart: false });

    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      autoStart: false,
    });
  });

  it("passes initialPhase to createSarmal", () => {
    createAction({ curve: circle, initialPhase: 1.5 });

    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      initialPhase: 1.5,
    });
  });

  it("passes pauseOnHidden to createSarmal", () => {
    createAction({ curve: circle, pauseOnHidden: true });

    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      pauseOnHidden: true,
    });
  });

  it("passes runtime visual options to createSarmal", () => {
    createAction({
      curve: circle,
      trailColor: "#ff0000",
      skeletonColor: "#00ff00",
      headColor: "#0000ff",
      trailStyle: "gradient-static",
      trailWidth: 1.5,
    });

    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      trailColor: "#ff0000",
      skeletonColor: "#00ff00",
      headColor: "#0000ff",
      trailStyle: "gradient-static",
      trailWidth: 1.5,
    });
  });
});

// ─── sarmalSVG (SVG action) ──────────────────────────────────────────────────

describe("sarmalSVG (SVG action)", () => {
  let svg: SVGSVGElement;

  beforeEach(() => {
    vi.clearAllMocks();
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  });

  function createAction(opts: Parameters<typeof sarmalSVG>[1]) {
    return sarmalSVG(svg, opts);
  }

  it("creates a sarmalSVG instance on mount", () => {
    createAction({ curve: circle });

    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, expect.any(Object));
  });

  it("calls destroy when action is destroyed", () => {
    const action = createAction({ curve: circle });

    action.destroy!();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("morphs when curve changes in update", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square });

    expect(mockInstance.morphTo).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {});
  });

  it("forwards morphDuration when curve changes with duration", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphDuration: 500 });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, { duration: 500 });
  });

  it("forwards morphStrategy when curve changes", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphStrategy: "raw" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, { morphStrategy: "raw" });
  });

  it("calls setRenderOptions when trailColor changes", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: circle, trailColor: "#00ff00" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#00ff00" });
  });

  it("calls setRenderOptions when skeletonColor changes", () => {
    const action = createAction({ curve: circle, skeletonColor: "#ffffff" });

    action.update!({ curve: circle, skeletonColor: "transparent" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ skeletonColor: "transparent" });
  });

  it("calls setRenderOptions when headColor changes", () => {
    const action = createAction({ curve: circle, headColor: "#ffffff" });

    action.update!({ curve: circle, headColor: "#ff0000" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ headColor: "#ff0000" });
  });

  it("calls setRenderOptions with null when headColor is removed", () => {
    const action = createAction({ curve: circle, headColor: "#ffffff" });

    action.update!({ curve: circle });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ headColor: null });
  });

  it("calls setRenderOptions when trailStyle changes", () => {
    const action = createAction({ curve: circle, trailStyle: "default" });

    action.update!({ curve: circle, trailStyle: "gradient-animated" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailStyle: "gradient-animated" });
  });

  it("calls setRenderOptions when trailWidth changes", () => {
    const action = createAction({ curve: circle, trailWidth: 1 });

    action.update!({ curve: circle, trailWidth: 2 });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailWidth: 2 });
  });

  it("destroys and recreates when trailLength changes", () => {
    const action = createAction({ curve: circle, trailLength: 60 });

    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailLength: 200 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when headRadius changes", () => {
    const action = createAction({ curve: circle, headRadius: 4 });

    action.update!({ curve: circle, headRadius: 10 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when autoStart changes", () => {
    const action = createAction({ curve: circle, autoStart: true });

    action.update!({ curve: circle, autoStart: false });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when initialPhase changes", () => {
    const action = createAction({ curve: circle, initialPhase: 0 });

    action.update!({ curve: circle, initialPhase: 0.5 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when pauseOnHidden changes", () => {
    const action = createAction({ curve: circle, pauseOnHidden: true });

    action.update!({ curve: circle, pauseOnHidden: false });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("does not recreate when runtime visual options change", () => {
    const action = createAction({ curve: circle });
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailColor: "#00ff00" });

    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);
    expect(mockInstance.destroy).not.toHaveBeenCalled();
  });

  it("does not recreate when curve changes (morphs instead)", () => {
    const action = createAction({ curve: circle });
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    action.update!({ curve: square });

    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalled();
  });

  it("applies both curve morph and render option changes in the same update", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: square, trailColor: "#00ff00" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {});
    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#00ff00" });
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);
  });

  it("uses shallow comparison for trailColor arrays", () => {
    const colors = ["#ff0000", "#00ff00"];
    const action = createAction({ curve: circle, trailColor: colors });

    action.update!({ curve: circle, trailColor: [...colors] });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("calls setRenderOptions when trailColor array content changes", () => {
    const action = createAction({ curve: circle, trailColor: ["#ff0000", "#00ff00"] });

    action.update!({ curve: circle, trailColor: ["#0000ff", "#ff00ff"] });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: ["#0000ff", "#ff00ff"],
    });
  });

  it("does not call setRenderOptions when trailColor is removed", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: circle });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("swallows morphTo rejection", async () => {
    mockInstance.morphTo.mockRejectedValueOnce(new Error("Instance destroyed during morph"));
    const action = createAction({ curve: circle });

    // should not throw or produce an unhandled rejection
    action.update!({ curve: square });
  });

  it("tracks prevOpts correctly after recreate so subsequent updates diff from new baseline", () => {
    const action = createAction({ curve: circle, trailLength: 60 });
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailLength: 200 });
    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);

    action.update!({ curve: circle, trailLength: 200, trailColor: "#ff0000" });
    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#ff0000" });
  });

  it("passes trailLength to createSarmalSVG", () => {
    createAction({ curve: circle, trailLength: 60 });

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      trailLength: 60,
    });
  });

  it("passes headRadius to createSarmalSVG", () => {
    createAction({ curve: circle, headRadius: 10 });

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      headRadius: 10,
    });
  });

  it("passes autoStart to createSarmalSVG", () => {
    createAction({ curve: circle, autoStart: false });

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      autoStart: false,
    });
  });

  it("passes initialPhase to createSarmalSVG", () => {
    createAction({ curve: circle, initialPhase: 1.5 });

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      initialPhase: 1.5,
    });
  });

  it("passes pauseOnHidden to createSarmalSVG", () => {
    createAction({ curve: circle, pauseOnHidden: true });

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      pauseOnHidden: true,
    });
  });

  it("passes runtime visual options to createSarmalSVG", () => {
    createAction({
      curve: circle,
      trailColor: "#ff0000",
      skeletonColor: "#00ff00",
      headColor: "#0000ff",
      trailStyle: "gradient-static",
    });

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      trailColor: "#ff0000",
      skeletonColor: "#00ff00",
      headColor: "#0000ff",
      trailStyle: "gradient-static",
    });
  });
});

// ─── sarmalDotMatrix (canvas action) ─────────────────────────────────────────

describe("sarmalDotMatrix (canvas action)", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement("canvas");
  });

  function createAction(opts: Parameters<typeof sarmalDotMatrix>[1]) {
    return sarmalDotMatrix(canvas, opts);
  }

  it("creates a sarmalDotMatrix instance on mount", () => {
    createAction({ curve: circle });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, expect.any(Object));
  });

  it("calls destroy when action is destroyed", () => {
    const action = createAction({ curve: circle });

    action.destroy!();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("morphs when curve changes in update", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square });

    expect(mockInstance.morphTo).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {});
  });

  it("forwards morphDuration when curve changes with duration", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphDuration: 500 });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, { duration: 500 });
  });

  it("forwards morphStrategy when curve changes", () => {
    const action = createAction({ curve: circle });

    action.update!({ curve: square, morphStrategy: "raw" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, { morphStrategy: "raw" });
  });

  it("calls setRenderOptions when trailColor changes", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: circle, trailColor: "#00ff00" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#00ff00" });
  });

  it("calls setRenderOptions when skeletonColor changes", () => {
    const action = createAction({ curve: circle, skeletonColor: "#ffffff" });

    action.update!({ curve: circle, skeletonColor: "transparent" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ skeletonColor: "transparent" });
  });

  it("calls setRenderOptions when trailStyle changes", () => {
    const action = createAction({ curve: circle, trailStyle: "default" });

    action.update!({ curve: circle, trailStyle: "gradient-animated" });

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailStyle: "gradient-animated" });
  });

  it("destroys and recreates when trailLength changes", () => {
    const action = createAction({ curve: circle, trailLength: 60 });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailLength: 200 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when cols changes", () => {
    const action = createAction({ curve: circle, cols: 16 });

    action.update!({ curve: circle, cols: 32 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when rows changes", () => {
    const action = createAction({ curve: circle, rows: 16 });

    action.update!({ curve: circle, rows: 32 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when roundness changes", () => {
    const action = createAction({ curve: circle, roundness: 0 });

    action.update!({ curve: circle, roundness: 1 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when autoStart changes", () => {
    const action = createAction({ curve: circle, autoStart: true });

    action.update!({ curve: circle, autoStart: false });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when initialPhase changes", () => {
    const action = createAction({ curve: circle, initialPhase: 0 });

    action.update!({ curve: circle, initialPhase: 0.5 });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when pauseOnHidden changes", () => {
    const action = createAction({ curve: circle, pauseOnHidden: true });

    action.update!({ curve: circle, pauseOnHidden: false });

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
  });

  it("does not recreate when runtime visual options change", () => {
    const action = createAction({ curve: circle });
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, trailColor: "#00ff00" });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);
    expect(mockInstance.destroy).not.toHaveBeenCalled();
  });

  it("does not recreate when curve changes (morphs instead)", () => {
    const action = createAction({ curve: circle });
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);

    action.update!({ curve: square });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);
    expect(mockInstance.destroy).not.toHaveBeenCalled();
    expect(mockInstance.morphTo).toHaveBeenCalled();
  });

  it("applies both curve morph and render option changes in the same update", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: square, trailColor: "#00ff00" });

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {});
    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#00ff00" });
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);
  });

  it("uses shallow comparison for trailColor arrays", () => {
    const colors = ["#ff0000", "#00ff00"];
    const action = createAction({ curve: circle, trailColor: colors });

    action.update!({ curve: circle, trailColor: [...colors] });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("does not call setRenderOptions when trailColor is removed", () => {
    const action = createAction({ curve: circle, trailColor: "#ff0000" });

    action.update!({ curve: circle });

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("swallows morphTo rejection", async () => {
    mockInstance.morphTo.mockRejectedValueOnce(new Error("Instance destroyed during morph"));
    const action = createAction({ curve: circle });

    // should not throw or produce an unhandled rejection
    action.update!({ curve: square });
  });

  it("tracks prevOpts correctly after recreate so subsequent updates diff from new baseline", () => {
    const action = createAction({ curve: circle, cols: 16 });
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(1);

    action.update!({ curve: circle, cols: 32 });
    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);

    // cols is now 32 in prevOpts; this should NOT recreate again
    action.update!({ curve: circle, cols: 32, trailColor: "#ff0000" });
    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledTimes(2);
    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({ trailColor: "#ff0000" });
  });

  it("passes cols to createSarmalDotMatrix", () => {
    createAction({ curve: circle, cols: 24 });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, { cols: 24 });
  });

  it("passes rows to createSarmalDotMatrix", () => {
    createAction({ curve: circle, rows: 24 });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, { rows: 24 });
  });

  it("passes roundness to createSarmalDotMatrix", () => {
    createAction({ curve: circle, roundness: 0.5 });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, { roundness: 0.5 });
  });

  it("passes trailLength to createSarmalDotMatrix", () => {
    createAction({ curve: circle, trailLength: 60 });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, { trailLength: 60 });
  });

  it("passes autoStart to createSarmalDotMatrix", () => {
    createAction({ curve: circle, autoStart: false });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, { autoStart: false });
  });

  it("passes initialPhase to createSarmalDotMatrix", () => {
    createAction({ curve: circle, initialPhase: 1.5 });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, {
      initialPhase: 1.5,
    });
  });

  it("passes pauseOnHidden to createSarmalDotMatrix", () => {
    createAction({ curve: circle, pauseOnHidden: true });

    expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(canvas, circle, {
      pauseOnHidden: true,
    });
  });
});

// ─── resolveCanvasSize ───────────────────────────────────────────────────────

describe("resolveCanvasSize", () => {
  let canvas: HTMLCanvasElement;
  let parent: HTMLDivElement;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    parent = document.createElement("div");
    canvas = document.createElement("canvas");
    parent.appendChild(canvas);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads dimensions from parent clientWidth/clientHeight", () => {
    Object.defineProperty(parent, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 300, configurable: true });

    expect(resolveCanvasSize(canvas)).toEqual({ width: 400, height: 300 });
  });

  it("overrides parent dimensions with explicit width/height", () => {
    Object.defineProperty(parent, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 300, configurable: true });

    expect(resolveCanvasSize(canvas, 200, 200)).toEqual({ width: 200, height: 200 });
  });

  it("falls back to 300x300 when parent has zero dimensions", () => {
    Object.defineProperty(parent, "clientWidth", { value: 0, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 0, configurable: true });

    expect(resolveCanvasSize(canvas)).toEqual({ width: 300, height: 300 });
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back to 300x300 when only one parent dimension is zero", () => {
    // The condition is (w > 0 && h > 0), so a single zero dimension causes fallback.
    Object.defineProperty(parent, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 0, configurable: true });

    expect(resolveCanvasSize(canvas)).toEqual({ width: 300, height: 300 });
    expect(console.warn).toHaveBeenCalled();
  });

  it("uses explicit dimensions even when parent is zero", () => {
    Object.defineProperty(parent, "clientWidth", { value: 0, configurable: true });
    Object.defineProperty(parent, "clientHeight", { value: 0, configurable: true });

    expect(resolveCanvasSize(canvas, 500, 400)).toEqual({ width: 500, height: 400 });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("handles canvas without a parent", () => {
    const orphan = document.createElement("canvas");
    expect(resolveCanvasSize(orphan)).toEqual({ width: 300, height: 300 });
    expect(console.warn).toHaveBeenCalled();
  });
});
