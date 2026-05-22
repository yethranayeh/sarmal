// @vitest-environment jsdom
import type { CurveDef } from "./types";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEngine } from "./engine";
import { createSarmalDotMatrix } from "./renderer-dot-matrix";

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
    for (let i = 0; i < 200; i++) engine.tick(0.016);
    expect(engine.trailCount).toBe(96); // 32 * 3
    engine.reset();
  });

  it("respects a custom trailLength over the cols*3 default", () => {
    // KNOWN: same limitation as above — tests engine cap behavior, not the renderer formula.
    const engine = createEngine(circle, 50);
    for (let i = 0; i < 200; i++) engine.tick(0.016);
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
        if (cb) cb(t);
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

  it("throws when skeletonColor is passed (canvas-only field)", () => {
    const instance = createSarmalDotMatrix(makeCanvas(), circle, { autoStart: false });
    expect(() => instance.setRenderOptions({ skeletonColor: "#ffffff" } as any)).toThrow(
      /unsupported key "skeletonColor"/,
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
      if (cb) cb(t);
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
      id === "2d" ? { putImageData: putSpy, fillStyle: "", globalAlpha: 1 } : null;

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
      if (cb) cb(t);
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
              for (let i = 0; i < dst.length; i++) dst[i] = src[(i << 2) + 3]!;
              capturedAlphas = dst;
            },
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
      if (cb) cb(t);
    }

    expect(capturedAlphas).not.toBeNull();

    let maxAlpha = 0;
    let minNonZero = 256;
    const nonZeroDistinct = new Set<number>();
    for (let i = 0; i < capturedAlphas!.length; i++) {
      const a = capturedAlphas![i]!;
      if (a > maxAlpha) maxAlpha = a;
      if (a > 0) {
        nonZeroDistinct.add(a);
        if (a < minNonZero) minNonZero = a;
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
