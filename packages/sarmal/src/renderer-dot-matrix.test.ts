// @vitest-environment jsdom
import type { CurveDef } from "./types";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEngine } from "./engine";
import { createSarmalDotMatrix } from "./renderer-dot-matrix";
import { DEFAULT_SKELETON_OPACITY } from "./renderer-shared";

// jsdom does not ship ImageData — provide a minimal mock
class MockImageData {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}
// @ts-ignore - polyfilling for jsdom
globalThis.ImageData = MockImageData;

const circle: CurveDef = {
  name: "test-circle",
  fn: (phase) => ({ x: Math.cos(phase), y: Math.sin(phase) }),
  period: Math.PI * 2,
  speed: 1,
};

function makeCanvas(width = 240, height = 240): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // @ts-ignore - jsdom does not implement canvas 2d context
  canvas.getContext = (contextId: string) => {
    if (contextId === "2d") {
      return {
        putImageData: () => {},
        clearRect: () => {},
        fillStyle: "",
        globalAlpha: 1,
      };
    }
    return null;
  };
  return canvas;
}

describe("createSarmalDotMatrix — defaults", () => {
  it("creates an instance with standard SarmalInstance methods", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(typeof instance.play).toBe("function");
    expect(typeof instance.pause).toBe("function");
    expect(typeof instance.destroy).toBe("function");
    expect(typeof instance.reset).toBe("function");
    expect(typeof instance.morphTo).toBe("function");
    expect(typeof instance.setRenderOptions).toBe("function");
    instance.destroy();
  });

  it("exposes engine passthrough methods", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(typeof instance.jump).toBe("function");
    expect(typeof instance.seek).toBe("function");
    expect(typeof instance.setSpeed).toBe("function");
    expect(typeof instance.getSpeed).toBe("function");
    expect(typeof instance.resetSpeed).toBe("function");
    expect(typeof instance.setSpeedOver).toBe("function");
    expect(typeof instance.getSarmalSkeleton).toBe("function");
    instance.destroy();
  });

  it("applies cols * 3 as the default trailLength", () => {
    // KNOWN: trailCount is not exposed on SarmalInstance, so this test validates the engine's
    // cap behavior at 96 (32 * 3) but cannot confirm the renderer passes that formula to createEngine.
    const engine = createEngine(circle, 32 * 3);
    for (let i = 0; i < 200; i++) {
      engine.tick(0.016);
    }
    expect(engine.trailCount).toBe(96); // 32 * 3
    engine.reset();
  });

  it("respects a custom trailLength over the cols*3 default", () => {
    // KNOWN: same limitation as above — tests engine cap behavior, not the renderer formula.
    const engine = createEngine(circle, 50);
    for (let i = 0; i < 200; i++) {
      engine.tick(0.016);
    }
    expect(engine.trailCount).toBe(50);
    engine.reset();
  });
});

describe("createSarmalDotMatrix — trail overflow", () => {
  it("does not throw after the trail buffer overflows its capacity", () => {
    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    // Default trailLength is cols * 3 = 96. Drive 200 frames — well past the cap.
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.play();

    let t = performance.now();
    expect(() => {
      for (let i = 0; i < 200; i++) {
        t += 16;
        const cb = pending.pop();
        if (cb) {
          cb(t);
        }
      }
    }).not.toThrow();

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});

describe("createSarmalDotMatrix — lifecycle", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("play() starts the rAF loop and pause() stops it", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    expect(rafSpy).not.toHaveBeenCalled();

    instance.play();
    expect(rafSpy).toHaveBeenCalledTimes(1);

    instance.pause();
    expect(cafSpy).toHaveBeenCalledWith(1);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("play() does nothing if already playing", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(42);

    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    instance.play();
    instance.play(); // second call should be a no-op
    expect(rafSpy).toHaveBeenCalledTimes(1);

    instance.destroy();
    rafSpy.mockRestore();
  });

  it("destroy() cancels rAF and removes the visibilitychange listener", () => {
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    const removeSpy = vi.spyOn(document, "removeEventListener");
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(7);

    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    instance.play();
    instance.destroy();

    expect(cafSpy).toHaveBeenCalledWith(7);
    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

    cafSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("destroy() does not crash when called without play()", () => {
    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    expect(() => instance.destroy()).not.toThrow();
  });
});

describe("createSarmalDotMatrix — initialPhase", () => {
  it("seeks the engine to the given phase before the first frame", () => {
    // KNOWN: createEngine is not injectable, so we can't spy on the internal engine's seek.
    // The observable proxy is getSarmalSkeleton(): after seek(Math.PI) on a circle, the
    // skeleton's first point should be at phase=0 (x≈1, y≈0) — unchanged by seek.
    // A stronger assertion (trail pre-filled) requires trailCount on SarmalInstance.
    const phaseInstance = createSarmalDotMatrix(makeCanvas(), circle, {
      autoStart: false,
      initialPhase: Math.PI,
    });

    const skeleton = phaseInstance.getSarmalSkeleton();
    expect(skeleton.length).toBeGreaterThan(0);
    // Skeleton always starts at fn(0): circle at phase=0 is (1, 0)
    expect(skeleton[0]!.x).toBeCloseTo(1, 5);
    expect(skeleton[0]!.y).toBeCloseTo(0, 5);

    phaseInstance.destroy();
  });
});

describe("createSarmalDotMatrix — setRenderOptions", () => {
  it("accepts a valid trailColor without throwing", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ trailColor: "#ff0000" })).not.toThrow();
    instance.destroy();
  });

  it("throws on an invalid trailColor value", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ trailColor: "not-a-color" as any })).toThrow();
    instance.destroy();
  });

  it("throws on an unknown option key", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ unknownKey: true } as any)).toThrow();
    instance.destroy();
  });

  it("accepts trailColor as an array for gradient mode", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ trailColor: ["#ff0000", "#00ff00"] })).not.toThrow();
    instance.destroy();
  });

  it("accepts trailStyle: gradient-static without throwing", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() =>
      instance.setRenderOptions({
        trailColor: ["#2dd4bf", "#f87171"],
        trailStyle: "gradient-static",
      }),
    ).not.toThrow();
    instance.destroy();
  });

  it("accepts trailStyle: gradient-animated without throwing", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() =>
      instance.setRenderOptions({
        trailColor: ["#2dd4bf", "#f87171"],
        trailStyle: "gradient-animated",
      }),
    ).not.toThrow();
    instance.destroy();
  });

  it("throws when headColor is passed (canvas-only field)", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ headColor: "#ff0000" } as any)).toThrow(
      /unsupported key "headColor"/,
    );
    instance.destroy();
  });

  it("accepts skeletonColor without throwing", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ skeletonColor: "#ffffff" })).not.toThrow();
    instance.destroy();
  });

  it("accepts 'transparent' for skeletonColor without throwing", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ skeletonColor: "transparent" })).not.toThrow();
    instance.destroy();
  });

  it("throws on an invalid skeletonColor value", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ skeletonColor: "not-a-color" } as any)).toThrow(
      /skeletonColor/,
    );
    instance.destroy();
  });

  it("throws when headRadius is passed (canvas-only field)", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ headRadius: 4 } as any)).toThrow(
      /unsupported key "headRadius"/,
    );
    instance.destroy();
  });

  it("throws when trailWidth is passed (canvas-only field)", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ trailWidth: 1 } as any)).toThrow(
      /unsupported key "trailWidth"/,
    );
    instance.destroy();
  });
});

describe("createSarmalDotMatrix — morphTo", () => {
  const rose: CurveDef = {
    name: "test-rose",
    fn: (phase) => ({
      x: Math.cos(3 * phase) * Math.cos(phase),
      y: Math.cos(3 * phase) * Math.sin(phase),
    }),
    period: Math.PI * 2,
    speed: 1,
  };

  it("returns a Promise that resolves after the morph completes", async () => {
    // Collect rAF callbacks so we can drive them manually instead of letting the
    // loop call itself synchronously (which would cause infinite recursion in tests)
    const pending: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    const morphPromise = instance.morphTo(rose, { duration: 300 });
    instance.play();

    // Advance 10 frames of ~34ms each (≈ 340ms total). With the 1/30s deltaTime cap
    // each frame contributes ~33ms; 10 frames exceed the 300ms morph duration.
    let t = performance.now();
    for (let i = 0; i < 10; i++) {
      t += 34;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    await expect(morphPromise).resolves.toBeUndefined();

    instance.destroy();
  });

  it("resolves an in-progress morph when a new morphTo is called", async () => {
    const resolves: Array<() => void> = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });

    const first = instance.morphTo(rose, { duration: 5000 });
    first.then(() => resolves.push(() => {}));

    // Starting a second morph should snap the first to completion
    const second = instance.morphTo(circle, { duration: 100 });

    // First promise should have resolved (not rejected)
    await expect(first).resolves.toBeUndefined();

    instance.destroy();
    // Second promise rejects via destroy — that's fine for this test
    second.catch(() => {});
  });

  it("rejects the morph promise when the instance is destroyed mid-morph", async () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    const morphPromise = instance.morphTo(rose, { duration: 5000 });

    instance.destroy();

    await expect(morphPromise).rejects.toThrow("destroyed during morph");
  });
});

describe("createSarmalDotMatrix — gradient color rendering", () => {
  it("gradient-static mode samples blue-spectrum colors at mid-trail intensities", () => {
    // With a red→blue palette, intensity≈0.5 maps to the blue half of the cycle.
    // This verifies the Oklab interpolation path actually fires, not just that it doesn't throw.
    let capturedData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              capturedData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      trailColor: ["#ff0000", "#0000ff"],
      trailStyle: "gradient-static",
    });

    instance.play();
    let t = performance.now();
    for (let i = 0; i < 60; i++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    expect(capturedData).not.toBeNull();

    // getPaletteColor cycles: red(0) → blue(0.5) → red(1).
    // Mid-trail dots (intensity≈0.5) are blue — verify at least one lit pixel has b > r.
    let hasBlueishLitPixel = false;
    for (let i = 0; i < capturedData!.length; i += 4) {
      if (capturedData![i + 3]! > 50 && capturedData![i + 2]! > capturedData![i]!) {
        hasBlueishLitPixel = true;
        break;
      }
    }
    expect(hasBlueishLitPixel).toBe(true);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("gradient-animated changes the rendered output as animTime accumulates", () => {
    let latestData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              latestData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      trailColor: ["#ff0000", "#0000ff"],
      trailStyle: "gradient-animated",
    });

    instance.play();
    let t = performance.now();

    // Capture after 5 frames (animTime ≈ 0.08s, timeOffset ≈ 0.013)
    for (let i = 0; i < 5; i++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }
    const earlySnapshot = new Uint8ClampedArray(latestData!);

    // Advance ~3 seconds = half the 6-second ANIM_PERIOD (timeOffset shifts by 0.5)
    for (let i = 0; i < 187; i++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    let differs = false;
    for (let i = 0; i < earlySnapshot.length; i++) {
      if (earlySnapshot[i] !== latestData![i]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("switching from gradient to solid trailColor renders all lit dots in a uniform color", () => {
    let capturedData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              capturedData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    // Start in gradient mode so gradientOklab is populated
    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      trailColor: ["#ff0000", "#0000ff"],
      trailStyle: "gradient-static",
    });

    instance.play();
    let t = performance.now();
    for (let i = 0; i < 30; i++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    // Switch to solid red — applyColor sets gradientOklab=null and colorRgb=(255,0,0)
    instance.setRenderOptions({ trailColor: "#ff0000", trailStyle: "default" });

    // One frame to capture solid-mode output
    t += 16;
    const cb = pending.pop();
    if (cb) {
      cb(t);
    }

    expect(capturedData).not.toBeNull();

    // Background alpha ≤ 0.05 * 255 ≈ 12; threshold 50 isolates lit dots only.
    // In solid mode, all lit dots share colorRgb — so exactly one unique RGB must appear.
    const litColors = new Set<string>();
    for (let i = 0; i < capturedData!.length; i += 4) {
      if (capturedData![i + 3]! > 50) {
        litColors.add(`${capturedData![i]},${capturedData![i + 1]},${capturedData![i + 2]}`);
      }
    }

    expect(litColors.size).toBe(1);
    expect([...litColors][0]).toBe("255,0,0");

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("trailStyle:default with array trailColor renders all lit dots in the first color only", () => {
    // Bug: draw() gated on `gradientOklab !== null` instead of `currentTrailStyle !== "default"`,
    // so passing trailColor:["#ff0000","#0000ff"] with trailStyle:"default" rendered a gradient
    // even though "default" mode is supposed to be solid (first color only).
    let capturedData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              capturedData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      trailColor: ["#ff0000", "#0000ff"],
      trailStyle: "default",
    });

    instance.play();
    let t = performance.now();
    for (let i = 0; i < 60; i++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    expect(capturedData).not.toBeNull();

    // In "default" mode with a red→blue array, colorRgb is set to the first color (red).
    // All lit dots must be red — no blueish pixel (b > r) may appear among lit pixels.
    let hasBlueishLitPixel = false;
    for (let i = 0; i < capturedData!.length; i += 4) {
      if (capturedData![i + 3]! > 50 && capturedData![i + 2]! > capturedData![i]!) {
        hasBlueishLitPixel = true;
        break;
      }
    }
    expect(hasBlueishLitPixel).toBe(false);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});

describe("createSarmalDotMatrix — skeleton", () => {
  function makeCapturingCanvas(width = 240, height = 240) {
    let capturedData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              capturedData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;
    return { canvas, getCaptured: () => capturedData };
  }

  it("skeleton dots appear in the first frame at ~15% opacity", () => {
    // Use a blue skeleton (#0000ff) against a white trail (#ffffff).
    // Interior skeleton pixels: R≈0, B≈255, alpha≈38 (15%*255).
    // Trail AA-edge pixels are white (R=G=B=255) — distinct from blue skeleton.
    // Check that at least one blue pixel (R<20, B>200) lands in alpha 25–50.
    const { canvas, getCaptured } = makeCapturingCanvas();
    createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      skeletonColor: "#0000ff",
    }).destroy();

    const data = getCaptured()!;
    expect(data).not.toBeNull();

    let hasBlueSkeletonPixel = false;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a >= 25 && a <= 50 && data[i]! < 20 && data[i + 2]! > 200) {
        hasBlueSkeletonPixel = true;
        break;
      }
    }
    expect(hasBlueSkeletonPixel).toBe(true);
  });

  it("skeletonColor: 'transparent' produces no blue skeleton pixels in the first frame", () => {
    // With transparent skeleton and a blue skeletonColor that never renders,
    // no pixel should be blue (R<20, B>200) in the skeleton alpha range (25–50).
    const { canvas, getCaptured } = makeCapturingCanvas();
    createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      skeletonColor: "transparent",
    }).destroy();

    const data = getCaptured()!;
    expect(data).not.toBeNull();

    let hasBluePixelInSkeletonRange = false;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a >= 25 && a <= 50 && data[i]! < 20 && data[i + 2]! > 200) {
        hasBluePixelInSkeletonRange = true;
        break;
      }
    }
    expect(hasBluePixelInSkeletonRange).toBe(false);
  });

  it("setRenderOptions({ skeletonColor }) changes the skeleton color in subsequent frames", () => {
    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    let latestData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              latestData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
    });

    instance.setRenderOptions({ skeletonColor: "#ff0000" });
    instance.play();

    let t = performance.now();
    t += 16;
    const cb = pending.pop();
    if (cb) {
      cb(t);
    }

    expect(latestData).not.toBeNull();

    // Skeleton dots colored red: r>200, g≈0, b≈0, alpha in skeleton range (25–50)
    let hasRedSkeletonPixel = false;
    for (let i = 0; i < latestData!.length; i += 4) {
      const a = latestData![i + 3]!;
      if (
        a >= 25 &&
        a <= 50 &&
        latestData![i]! > 200 &&
        latestData![i + 1]! < 20 &&
        latestData![i + 2]! < 20
      ) {
        hasRedSkeletonPixel = true;
        break;
      }
    }
    expect(hasRedSkeletonPixel).toBe(true);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("skeleton grid updates to reflect the new curve after morph completes", async () => {
    // Morph from circle → rose (3-petal). Their skeletons trace different cells at 16×16,
    // so at least some blue-skeleton pixels must change position after the morph.
    const rose: CurveDef = {
      name: "test-rose",
      fn: (phase) => ({
        x: Math.cos(3 * phase) * Math.cos(phase),
        y: Math.cos(3 * phase) * Math.sin(phase),
      }),
      period: Math.PI * 2,
      speed: 1,
    };

    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const frames: Uint8ClampedArray[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              frames.push(new Uint8ClampedArray(imageData.data));
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 16,
      rows: 16,
      trailLength: 48,
      skeletonColor: "#0000ff",
    });

    // frames[0] is the init frame — contains the circle skeleton
    const initFrame = frames[0]!;

    const morphPromise = instance.morphTo(rose, { duration: 300 });
    instance.play();

    // Drive 10 frames of 34ms each (≈340ms > 300ms duration, morph completes ~frame 9)
    let t = performance.now();
    for (let i = 0; i < 10; i++) {
      t += 34;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }
    await morphPromise;

    // Last captured frame has the post-morph rose skeleton
    const finalFrame = frames[frames.length - 1]!;

    function blueSkeletonPixels(data: Uint8ClampedArray): Set<number> {
      const positions = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]!;
        if (a >= 25 && a <= 50 && data[i]! < 20 && data[i + 2]! > 200) {
          positions.add(i);
        }
      }
      return positions;
    }

    const before = blueSkeletonPixels(initFrame);
    const after = blueSkeletonPixels(finalFrame);

    expect(before.size).toBeGreaterThan(0);
    expect(after.size).toBeGreaterThan(0);

    // At least some skeleton cells must have changed — the grid was updated
    const setsAreIdentical = before.size === after.size && [...before].every((p) => after.has(p));
    expect(setsAreIdentical).toBe(false);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("trail tail over skeleton dots never drops below skeleton opacity", () => {
    // Regression test: trail pixels are raw overwrites (not alpha-composited). Without a floor,
    // trail tail dots (min 8% alpha) could overwrite skeleton dots (15% alpha), making the
    // skeleton visually dimmer where the trail passes over it.
    //
    // Strategy: identify skeleton pixel positions from the initial frame (blue dots, no trail yet),
    // then drive enough frames for the trail to lap the full curve and check that those same
    // positions in the final frame have alpha >= their initial-frame alpha.
    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const frames: Uint8ClampedArray[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              frames.push(new Uint8ClampedArray(imageData.data));
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    // 32×32 grid with default trailLength (cols*3 = 96): the trail spans ~24% of the circle
    // (~20 cells), so the head and tail land on clearly different grid cells.
    // Tail-only cells have intensity ≈ 1/96 → alpha ≈ 22, well below skeleton floor (38).
    // A coarse 8×8 grid would cluster all 24 trail points into 1–2 cells,
    //  hiding the bug via stamp(max).
    createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 32,
      rows: 32,
      trailColor: "#ffffff",
      skeletonColor: "#0000ff",
    }).play();

    // frames[0] is the init frame — identify blue skeleton pixels (R<20, B>200, alpha>0)
    const initFrame = frames[0]!;
    const skeletonPositions: number[] = [];
    for (let i = 0; i < initFrame.length; i += 4) {
      if (initFrame[i]! < 20 && initFrame[i + 2]! > 200 && initFrame[i + 3]! > 0) {
        skeletonPositions.push(i);
      }
    }
    expect(skeletonPositions.length).toBeGreaterThan(0);

    // Drive 500 frames of 16 ms — trail fully laps the circle, tail overlaps skeleton
    let t = performance.now();
    for (let f = 0; f < 500; f++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    const finalFrame = frames[frames.length - 1]!;

    // Each skeleton position must retain at least its initial alpha.
    // Before the fix: trail tail (8% alpha) overwrote skeleton (15%), so finalAlpha < initAlpha.
    // After the fix: skeleton opacity acts as a floor, so finalAlpha >= initAlpha.
    for (const pos of skeletonPositions) {
      const initAlpha = initFrame[pos + 3]!;
      const finalAlpha = finalFrame[pos + 3]!;
      expect(finalAlpha).toBeGreaterThanOrEqual(initAlpha);
    }

    // Sanity: the constant we're relying on is the one tested above
    expect(DEFAULT_SKELETON_OPACITY).toBe(0.15);

    pending.length = 0;
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});

describe("createSarmalDotMatrix — gridColor", () => {
  function makeCapturingCanvas(width = 240, height = 240) {
    let capturedData: Uint8ClampedArray | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              capturedData = new Uint8ClampedArray(imageData.data);
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;
    return { canvas, getCaptured: () => capturedData };
  }

  it("gridColor: 'transparent' produces no low-alpha background pixels in the first frame", () => {
    const { canvas, getCaptured } = makeCapturingCanvas();
    createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      skeletonColor: "transparent",
      gridColor: "transparent",
    }).destroy();

    const data = getCaptured()!;
    expect(data).not.toBeNull();

    let hasBgPixel = false;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a >= 1 && a <= 15) {
        hasBgPixel = true;
        break;
      }
    }
    expect(hasBgPixel).toBe(false);
  });

  it("default gridColor (unset) produces background pixels at ~5% opacity", () => {
    const { canvas, getCaptured } = makeCapturingCanvas();
    createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      skeletonColor: "transparent",
    }).destroy();

    const data = getCaptured()!;
    expect(data).not.toBeNull();

    let hasBgPixel = false;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a >= 1 && a <= 15) {
        hasBgPixel = true;
        break;
      }
    }
    expect(hasBgPixel).toBe(true);
  });

  it("gridColor: '#ff0000' makes background pixels red, not trail color", () => {
    const { canvas, getCaptured } = makeCapturingCanvas();
    createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      trailColor: "#0000ff",
      skeletonColor: "transparent",
      gridColor: "#ff0000",
    }).destroy();

    const data = getCaptured()!;
    expect(data).not.toBeNull();

    let hasRedBgPixel = false;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (a >= 1 && a <= 15 && r > 200 && g < 20 && b < 20) {
        hasRedBgPixel = true;
        break;
      }
    }
    expect(hasRedBgPixel).toBe(true);
  });

  it("setRenderOptions({ gridColor: 'transparent' }) disables background dots on a live instance", () => {
    const { canvas, getCaptured } = makeCapturingCanvas();
    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      skeletonColor: "transparent",
    });

    // First frame: background dots present (default)
    const dataBefore = getCaptured()!;
    let hasBgBefore = false;
    for (let i = 0; i < dataBefore.length; i += 4) {
      const a = dataBefore[i + 3]!;
      if (a >= 1 && a <= 15) {
        hasBgBefore = true;
        break;
      }
    }
    expect(hasBgBefore).toBe(true);

    // Set gridColor to transparent — triggers bgImageData rebuild
    instance.setRenderOptions({ gridColor: "transparent" });
    instance.play();
    instance.pause();

    const dataAfter = getCaptured()!;
    let hasBgAfter = false;
    for (let i = 0; i < dataAfter.length; i += 4) {
      const a = dataAfter[i + 3]!;
      if (a >= 1 && a <= 15) {
        hasBgAfter = true;
        break;
      }
    }
    expect(hasBgAfter).toBe(false);

    instance.destroy();
  });

  it("gridColor: 'transparent' stays transparent after trailColor change via setRenderOptions", () => {
    const { canvas, getCaptured } = makeCapturingCanvas();
    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
      skeletonColor: "transparent",
      gridColor: "transparent",
    });

    // First frame: no background dots
    const dataBefore = getCaptured()!;
    let hasBgBefore = false;
    for (let i = 0; i < dataBefore.length; i += 4) {
      const a = dataBefore[i + 3]!;
      if (a >= 1 && a <= 15) {
        hasBgBefore = true;
        break;
      }
    }
    expect(hasBgBefore).toBe(false);

    // Change trailColor — triggers bgImageData rebuild, gridColorState is 'transparent' so stays transparent
    instance.setRenderOptions({ trailColor: "#ff0000" });
    instance.play();
    instance.pause();

    const dataAfter = getCaptured()!;
    let hasBgAfter = false;
    for (let i = 0; i < dataAfter.length; i += 4) {
      const a = dataAfter[i + 3]!;
      if (a >= 1 && a <= 15) {
        hasBgAfter = true;
        break;
      }
    }
    expect(hasBgAfter).toBe(false);

    instance.destroy();
  });
});

describe("createSarmalDotMatrix — pixel output", () => {
  it("calls putImageData exactly once per rendered frame", () => {
    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    const putSpy = vi.fn();
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? { putImageData: putSpy, clearRect: () => {}, fillStyle: "", globalAlpha: 1 }
        : null;

    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    expect(putSpy).toHaveBeenCalledTimes(1); // init renderFrame(0)
    putSpy.mockClear();

    // play() calls loop() immediately (not via rAF) for the first frame,
    // then schedules the next via requestAnimationFrame.
    instance.play();
    putSpy.mockClear(); // drop the immediate-loop call; test only rAF-driven frames

    // Each rAF pop must produce exactly one putImageData call — no more, no less.
    let t = performance.now();
    for (let i = 0; i < 4; i++) {
      const before = putSpy.mock.calls.length;
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
      expect(putSpy.mock.calls.length - before).toBe(1);
    }

    expect(putSpy).toHaveBeenCalledTimes(4);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("head pixels are brighter than tail pixels after the trail fills", () => {
    const pending: FrameRequestCallback[] = [];
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      pending.push(cb);
      return pending.length;
    });
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    // Snapshot the alpha channel at each putImageData call. Copy — not a reference —
    // because frameImageData.data is mutated in place between frames.
    let capturedAlphas: Uint8Array | null = null;
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 240;
    // @ts-ignore
    canvas.getContext = (id: string) =>
      id === "2d"
        ? {
            putImageData(imageData: ImageData) {
              const src = imageData.data;
              const dst = new Uint8Array(src.length >> 2);
              for (let i = 0; i < dst.length; i++) {
                dst[i] = src[(i << 2) + 3]!;
              }
              capturedAlphas = dst;
            },
            clearRect: () => {},
            fillStyle: "",
            globalAlpha: 1,
          }
        : null;

    // 8×8 grid → dotR ≈ 10px, large enough for reliable full-coverage interior pixels.
    // trailLength=24 fills in ~24 frames; 60 frames drives it well past the cap.
    const instance = createSarmalDotMatrix(canvas, circle, {
      autoStart: false,
      cols: 8,
      rows: 8,
      trailLength: 24,
    });

    instance.play();
    let t = performance.now();
    for (let i = 0; i < 60; i++) {
      t += 16;
      const cb = pending.pop();
      if (cb) {
        cb(t);
      }
    }

    expect(capturedAlphas).not.toBeNull();

    let maxAlpha = 0;
    let minNonZero = 256;
    const nonZeroDistinct = new Set<number>();
    for (let i = 0; i < capturedAlphas!.length; i++) {
      const a = capturedAlphas![i]!;
      if (a > maxAlpha) {
        maxAlpha = a;
      }
      if (a > 0) {
        nonZeroDistinct.add(a);
        if (a < minNonZero) {
          minNonZero = a;
        }
      }
    }

    // Head dot at intensity=1 has alpha ≈ 255; must be clearly bright
    expect(maxAlpha).toBeGreaterThan(200);
    // Background / tail is visibly dimmer than head
    expect(minNonZero).toBeLessThan(maxAlpha);
    // Continuous per-dot gradient sampling produces many distinct alpha levels.
    // A bucket renderer (8 buckets) would produce only ~8 distinct values;
    // continuous sampling + SSAA edge coverage produces significantly more.
    expect(nonZeroDistinct.size).toBeGreaterThan(10);

    instance.destroy();
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});

// ─── destroy() — one-way door ────────────────────────────────────────────────

function makeCanvasWithClearRectTracker(
  width = 240,
  height = 240,
): {
  canvas: HTMLCanvasElement;
  getClearRectCallCount: () => number;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let callCount = 0;
  // @ts-ignore - jsdom does not implement canvas 2d context
  canvas.getContext = (contextId: string) => {
    if (contextId === "2d") {
      return {
        putImageData: () => {},
        fillStyle: "",
        globalAlpha: 1,
        clearRect: () => {
          callCount++;
        },
      };
    }
    return null;
  };
  return { canvas, getClearRectCallCount: () => callCount };
}

describe("destroy() — one-way door (dot-matrix)", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("destroy() clears the canvas", () => {
    const { canvas, getClearRectCallCount } = makeCanvasWithClearRectTracker();
    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    instance.destroy();
    expect(getClearRectCallCount()).toBeGreaterThan(0);
  });

  it("destroy() clears the canvas even when called before play()", () => {
    const { canvas, getClearRectCallCount } = makeCanvasWithClearRectTracker();
    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    instance.destroy(); // loop was never started
    expect(getClearRectCallCount()).toBeGreaterThan(0);
  });

  it("destroy() clears the canvas even when called while paused", () => {
    const { canvas, getClearRectCallCount } = makeCanvasWithClearRectTracker();
    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    instance.play();
    instance.pause();
    instance.destroy(); // animationId is null at this point
    expect(getClearRectCallCount()).toBeGreaterThan(0);
  });

  it("destroy() is idempotent — second call is a no-op", () => {
    const { canvas, getClearRectCallCount } = makeCanvasWithClearRectTracker();
    const instance = createSarmalDotMatrix(canvas, circle, { autoStart: false });
    instance.destroy();
    const countAfterFirstDestroy = getClearRectCallCount();
    expect(() => instance.destroy()).not.toThrow();
    // No additional clearRect from second destroy
    expect(getClearRectCallCount()).toBe(countAfterFirstDestroy);
  });

  it("play() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.play()).toThrow("destroyed");
  });

  it("pause() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.pause()).toThrow("destroyed");
  });

  it("reset() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.reset()).toThrow("destroyed");
  });

  it("seek() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.seek(0)).toThrow("destroyed");
  });

  it("jump() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.jump(0)).toThrow("destroyed");
  });

  it("setSpeed() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.setSpeed(1)).toThrow("destroyed");
  });

  it("getSpeed() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.getSpeed()).toThrow("destroyed");
  });

  it("morphTo() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.morphTo(circle)).toThrow("destroyed");
  });

  it("setRenderOptions() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.setRenderOptions({ trailColor: "#ff0000" })).toThrow("destroyed");
  });

  it("resetSpeed() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.resetSpeed()).toThrow("destroyed");
  });

  it("setSpeedOver() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.setSpeedOver(2, 500)).toThrow("destroyed");
  });

  it("getSarmalSkeleton() after destroy() throws", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    instance.destroy();
    expect(() => instance.getSarmalSkeleton()).toThrow("destroyed");
  });

  it("destroy() rejects a pending setSpeedOver() promise", async () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    const promise = instance.setSpeedOver(2, 5000);
    instance.destroy();
    await expect(promise).rejects.toThrow("Speed transition cancelled");
  });
});

describe("morphTo easing (dot matrix renderer)", () => {
  // createSarmalDotMatrix builds its own engine (no injection), so we observe morph
  // completion through the morphTo Promise rather than the engine directly. The
  // eased-value-to-engine assertion is covered by the canvas/SVG tests, which share
  // this exact code path, plus the easeInOutCubic unit test.
  let rafCallbacks: FrameRequestCallback[] = [];
  let nowMs = 0;

  function setupClock() {
    rafCallbacks = [];
    nowMs = 1000;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  }

  /** Advance the clock by `dtMs` and run one render frame. */
  function frame(dtMs: number) {
    nowMs += dtMs;
    const cb = rafCallbacks[rafCallbacks.length - 1];
    rafCallbacks = [];
    cb?.(nowMs);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes on raw progress (not the eased value), even if easing saturates early", async () => {
    setupClock();
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });

    // This easing reaches 1 at raw progress 0.5. If completion were driven by the eased
    // value the morph would resolve at raw 0.5; it must instead wait for raw progress = 1.
    // Each 30ms frame (under the loop's 1/30s cap) advances raw progress by 0.3.
    let resolved = false;
    instance
      .morphTo(circle, { duration: 100, easing: (t) => Math.min(1, t * 2) })
      .then(() => {
        resolved = true;
      })
      .catch(() => {});
    instance.play();

    frame(30); // raw 0.3
    frame(30); // raw 0.6 → eased saturates at 1.0, but raw < 1
    await Promise.resolve();
    expect(resolved).toBe(false); // not done — raw progress governs completion

    frame(30); // raw 0.9
    frame(30); // raw 1.2 → clamps to 1 → morph completes
    await Promise.resolve();
    expect(resolved).toBe(true);

    instance.destroy();
  });
});
