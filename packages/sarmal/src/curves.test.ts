import { describe, it, expect } from "vitest";
import { curves } from "./curves";
import type { CurveName } from "./curves";
import { createEngine } from "./engine";
import type { CurveDef, Point } from "./types";

const TWO_PI = Math.PI * 2;
const EMPTY_PARAMS: Record<string, number> = {};

function sampleAllCurves(fn: (curve: CurveDef, name: CurveName) => void) {
  const curveNames = Object.keys(curves) as CurveName[];
  for (const name of curveNames) {
    fn(curves[name]!, name);
  }
}

describe("curves regression suite", () => {
  it("all 14 curve keys are unique", () => {
    const names = Object.keys(curves);
    expect(new Set(names).size).toBe(names.length);
  });

  sampleAllCurves((curve, name) => {
    it(`${name}: returns finite values across 100 sampled points`, () => {
      const period = curve.period ?? TWO_PI;
      const steps = 100;
      for (let i = 0; i <= steps; i++) {
        const phase = (i / steps) * period;
        const elapsed = phase / (curve.speed ?? 1);
        const point = curve.fn(phase, elapsed, EMPTY_PARAMS);
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    });
  });
});

describe("period boundary continuity", () => {
  sampleAllCurves((curve, name) => {
    it(`${name}: fn(0, 0) roughly equals fn(period, 0)`, () => {
      const period = curve.period ?? TWO_PI;
      const a = curve.fn(0, 0, EMPTY_PARAMS);
      const b = curve.fn(period, 0, EMPTY_PARAMS);
      expect(Math.abs(a.x - b.x)).toBeLessThan(1e-10);
      expect(Math.abs(a.y - b.y)).toBeLessThan(1e-10);
    });
  });

  it("rose52: fn(0, 0) differs from fn(2π, 0) — halfway through its 4π period", () => {
    const curve = curves.rose52!;
    const a = curve.fn(0, 0, EMPTY_PARAMS);
    const b = curve.fn(TWO_PI, 0, EMPTY_PARAMS);
    const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    expect(dist).toBeGreaterThan(1e-6);
  });
});

describe("live skeleton contracts", () => {
  const LIVE_CURVE_NAMES: CurveName[] = ["lame", "lissajous32", "lissajous43"];
  const STATIC_CURVE_NAME: CurveName = "rose3";

  for (const name of LIVE_CURVE_NAMES) {
    it(`${name}: isLiveSkeleton is true`, () => {
      const engine = createEngine(curves[name]!, 60);
      expect(engine.isLiveSkeleton).toBe(true);
    });

    it(`${name}: skeleton changes after tick() advances elapsed`, () => {
      const engine = createEngine(curves[name]!, 60);
      const before = snapshotSkeleton(engine);
      for (let i = 0; i < 10; i++) engine.tick(0.05);
      const after = snapshotSkeleton(engine);
      expect(skeletonsDiffer(before, after)).toBe(true);
    });
  }

  it(`${STATIC_CURVE_NAME}: isLiveSkeleton is false`, () => {
    const engine = createEngine(curves[STATIC_CURVE_NAME]!, 60);
    expect(engine.isLiveSkeleton).toBe(false);
  });

  it(`${STATIC_CURVE_NAME}: skeleton is stable after tick()`, () => {
    const engine = createEngine(curves[STATIC_CURVE_NAME]!, 60);
    const before = snapshotSkeleton(engine);
    for (let i = 0; i < 10; i++) engine.tick(0.05);
    const after = snapshotSkeleton(engine);
    expect(skeletonsDiffer(before, after)).toBe(false);
  });
});

describe("elapsed-dependent curves", () => {
  const TIME_DEPENDENT: CurveName[] = ["lame", "lissajous32", "lissajous43"];

  for (const name of TIME_DEPENDENT) {
    it(`${name}: same phase with different elapsed produces different output`, () => {
      const curve = curves[name]!;
      const period = curve.period ?? TWO_PI;
      const phase = period * 0.3;
      const a = curve.fn(phase, 0, EMPTY_PARAMS);
      const b = curve.fn(phase, 10, EMPTY_PARAMS);
      const dist = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      expect(dist).toBeGreaterThan(1e-10);
    });
  }

  it("rose3: same phase with different elapsed produces same output (static curve)", () => {
    const curve = curves.rose3!;
    const a = curve.fn(1.0, 0, EMPTY_PARAMS);
    const b = curve.fn(1.0, 100, EMPTY_PARAMS);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
  });
});

describe("skeletonFn override", () => {
  it("epitrochoid7: skeletonFn differs from fn at same phase", () => {
    const curve = curves.epitrochoid7!;
    const skeletonFn = curve.skeletonFn!;
    const samplePhases = [0, 0.5, 1.0, 1.5, Math.PI, 3.0];
    let anyDiffer = false;
    for (const phase of samplePhases) {
      const a = curve.fn(phase, 0, EMPTY_PARAMS);
      const b = skeletonFn(phase);
      if (Math.abs(a.x - b.x) > 1e-10 || Math.abs(a.y - b.y) > 1e-10) {
        anyDiffer = true;
        break;
      }
    }
    expect(anyDiffer).toBe(true);
  });
});

describe("artemis2 spline closure", () => {
  it("first and last spline point roughly coincide (closed Catmull-Rom)", () => {
    const curve = curves.artemis2!;
    const a = curve.fn(0, 0, EMPTY_PARAMS);
    const b = curve.fn(TWO_PI, 0, EMPTY_PARAMS);
    expect(Math.abs(a.x - b.x)).toBeLessThan(1e-10);
    expect(Math.abs(a.y - b.y)).toBeLessThan(1e-10);
  });
});

describe("speed propagation through engine", () => {
  it("respects curve-defined speed", () => {
    const engine = createEngine({ name: "test", speed: 2.5, fn: (p) => ({ x: p, y: 0 }) });
    expect(engine.getSpeed()).toBe(2.5);
  });

  it("setSpeed(0) freezes phase — all trail points are identical", () => {
    const engine = createEngine({ name: "test", speed: 1, fn: (p) => ({ x: p, y: 0 }) }, 10);
    engine.setSpeed(0);
    for (let i = 0; i < 10; i++) engine.tick(0.1);
    const trail = engine.tick(0);
    for (let i = 0; i < engine.trailCount; i++) {
      expect(trail[i]!.x).toBe(0);
      expect(trail[i]!.y).toBe(0);
    }
    expect(engine.trailCount).toBe(10);
  });

  it("resetSpeed() reverts to curve default", () => {
    const engine = createEngine({ name: "test", speed: 2.0, fn: (p) => ({ x: p, y: 0 }) });
    engine.setSpeed(99);
    engine.resetSpeed();
    expect(engine.getSpeed()).toBe(2.0);
  });
});

describe("extreme jump values", () => {
  it("jump(NaN) does not throw", () => {
    const engine = createEngine(
      { name: "test", speed: 1, fn: (p) => ({ x: p, y: 0 }), period: 10 },
      10,
    );
    expect(() => engine.jump(NaN)).not.toThrow();
  });

  it("jump(Infinity) does not throw", () => {
    const engine = createEngine(
      { name: "test", speed: 1, fn: (p) => ({ x: p, y: 0 }), period: 10 },
      10,
    );
    expect(() => engine.jump(Infinity)).not.toThrow();
  });

  it("jump(-1) wraps to period - 1", () => {
    const engine = createEngine(
      { name: "test", speed: 1, fn: (p) => ({ x: p, y: 0 }), period: 10 },
      10,
    );
    engine.jump(-1);
    const t = engine.tick(0);
    expect(t[0]!.x).toBe(9);
  });
});

describe("user-defined curves", () => {
  it("curve with period: undefined uses engine default of 2π", () => {
    const custom: CurveDef = {
      name: "custom",
      fn: (phase) => ({ x: Math.cos(phase), y: Math.sin(phase) }),
    };
    const engine = createEngine(custom);
    const skeleton = engine.getSarmalSkeleton();
    expect(skeleton.length).toBe(Math.ceil(TWO_PI * 50));
  });
});

function snapshotSkeleton(engine: ReturnType<typeof createEngine>): Point[] {
  return engine.getSarmalSkeleton().map((p) => ({ x: p.x, y: p.y }));
}

function skeletonsDiffer(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]!.x - b[i]!.x) > 1e-10 || Math.abs(a[i]!.y - b[i]!.y) > 1e-10) {
      return true;
    }
  }
  return false;
}
