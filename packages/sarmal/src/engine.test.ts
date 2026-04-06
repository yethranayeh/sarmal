import { describe, it, expect } from "vitest";
import { createEngine } from "./engine";
import type { CurveDef } from "./types";

// ─── Fixtures ────────────────────────────────────────────────────────────────
//
// Never use curves from curves.ts in tests — their math is complex and results
// can't be verified by hand.

const TWO_PI = Math.PI * 2;

/**
 * Unit circle.
 * Primary fixture for getSarmalSkeleton tests and general curve output checks.
 * fn(t) = { x: cos(t), y: sin(t) }
 */
const circle: CurveDef = {
  name: "test-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: TWO_PI,
  speed: 1,
};

/**
 * Identity curve — outputs t as x, actualTime as y.
 * Period = 10 keeps all arithmetic in whole numbers when trailLength = 10.
 * Use this when you need to observe `t` or `actualTime` through curve output.
 */
const identity: CurveDef = {
  name: "test-identity",
  fn: (t, time) => ({ x: t, y: time }),
  period: 10,
  speed: 1,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read the last valid point from a trail without advancing state further. */
function lastPoint(trail: ReturnType<ReturnType<typeof createEngine>["tick"]>, count: number) {
  return trail[count - 1]!;
}

// ─── tick(dt) ─────────────────────────────────────────────────────────────────

describe("tick(dt)", () => {
  it("advances t by speed * dt", () => {
    const engine = createEngine(identity);
    // dt=1 → t = 0 + 1*1 = 1, actualTime = 1 → fn(1, 1) = {x:1, y:1}
    const trail = engine.tick(1);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(1);
    expect(p.y).toBe(1);
  });

  it("respects the speed multiplier", () => {
    const fast: CurveDef = { ...identity, speed: 3 };
    const engine = createEngine(fast);
    // dt=1, speed=3 → t = 0 + 3*1 = 3
    const trail = engine.tick(1);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(3);
  });

  it("wraps t at period", () => {
    const engine = createEngine(identity); // period = 10
    // dt=11 → t = (0 + 11) % 10 = 1
    const trail = engine.tick(11);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(1);
  });

  it("accumulates actualTime across ticks (not reset on wrap)", () => {
    const engine = createEngine(identity);
    engine.tick(6); // t wraps: (6 % 10) = 6; actualTime = 6
    const trail = engine.tick(6); // t = (6+6)%10 = 2; actualTime = 12
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(2); // t = 2
    expect(p.y).toBe(12); // actualTime = 12 — did NOT wrap with t
  });

  it("trailCount grows from 0 up to trailLength then stays there", () => {
    const engine = createEngine(identity, 5);
    expect(engine.trailCount).toBe(0);
    for (let i = 1; i <= 5; i++) {
      engine.tick(1);
      expect(engine.trailCount).toBe(i);
    }
    engine.tick(1);
    expect(engine.trailCount).toBe(5); // capped at trailLength
  });

  it("KNOWN: returns the same array reference on every call — mutable buffer", () => {
    // The trail buffer is pre-allocated and reused for performance.
    // Do not save this reference and tick again before reading — values will be overwritten.
    const engine = createEngine(identity);
    const ref1 = engine.tick(1);
    const ref2 = engine.tick(1);
    expect(ref1).toBe(ref2);
  });

  it("KNOWN: trail array .length is always trailLength, not trailCount", () => {
    // Only the first engine.trailCount elements are valid.
    // Using trail.length to iterate will read stale zero-initialized data.
    const engine = createEngine(identity, 10);
    engine.tick(1);
    const trail = engine.tick(1);
    expect(trail.length).toBe(10); // always full capacity
    expect(engine.trailCount).toBe(2); // only 2 valid entries
  });

  it("the point at trail[trailCount-1] matches fn(t, actualTime) for the current tick", () => {
    const engine = createEngine(identity);
    engine.tick(3); // t=3, actualTime=3
    const trail = engine.tick(2); // t=5, actualTime=5
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(5);
    expect(p.y).toBe(5);
  });
});

// ─── reset() ─────────────────────────────────────────────────────────────────

describe("reset()", () => {
  it("sets trailCount to 0", () => {
    const engine = createEngine(identity);
    engine.tick(1);
    engine.tick(1);
    engine.reset();
    expect(engine.trailCount).toBe(0);
  });

  it("resets t to 0", () => {
    const engine = createEngine(identity);
    engine.tick(4); // t=4
    engine.reset();
    const trail = engine.tick(0); // t = (0 + 0) % 10 = 0, actualTime=0
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(0); // x = t = 0
  });

  it("resets actualTime to 0", () => {
    const engine = createEngine(identity);
    engine.tick(7); // actualTime=7
    engine.reset();
    const trail = engine.tick(0); // actualTime = 0
    const p = lastPoint(trail, engine.trailCount);
    expect(p.y).toBe(0); // y = actualTime = 0
  });

  it("next tick after reset behaves as if engine was just created", () => {
    const engine = createEngine(identity, 10);
    for (let i = 0; i < 20; i++) engine.tick(1);
    engine.reset();
    expect(engine.trailCount).toBe(0);
    const trail = engine.tick(2); // t=2, actualTime=2
    expect(engine.trailCount).toBe(1);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(2);
    expect(p.y).toBe(2);
  });
});

// ─── seek(t, options) ────────────────────────────────────────────────────────

describe("seek(t, options)", () => {
  it("updates t to the given value", () => {
    const engine = createEngine(identity);
    engine.seek(7);
    const trail = engine.tick(0); // t stays at 7 (dt=0), observe x = t
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(7);
  });

  it("wraps t for values >= period", () => {
    const engine = createEngine(identity); // period=10
    engine.seek(13); // 13 % 10 = 3
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(3);
  });

  it("wraps negative t correctly into [0, period)", () => {
    const engine = createEngine(identity); // period=10
    engine.seek(-3); // ((-3 % 10) + 10) % 10 = 7
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(7);
  });

  it("does NOT modify actualTime — seek is position-only", () => {
    const engine = createEngine(identity);
    engine.tick(5); // actualTime = 5
    engine.seek(2); // position-only — actualTime must remain 5
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.y).toBe(5); // y = actualTime — unchanged by seek
  });

  it("preserves the trail by default", () => {
    const engine = createEngine(identity);
    engine.tick(1);
    engine.tick(1);
    const countBefore = engine.trailCount;
    engine.seek(7);
    expect(engine.trailCount).toBe(countBefore);
  });

  it("clears the trail with clearTrail: true", () => {
    const engine = createEngine(identity);
    engine.tick(1);
    engine.tick(1);
    engine.seek(7, { clearTrail: true });
    expect(engine.trailCount).toBe(0);
  });

  it("next tick after seek advances t from the seeked position", () => {
    const engine = createEngine(identity); // period=10
    engine.seek(6);
    const trail = engine.tick(3); // t = (6+3) % 10 = 9
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(9);
  });

  it("next tick after seek wraps t correctly when it crosses period", () => {
    const engine = createEngine(identity); // period=10
    engine.seek(8);
    const trail = engine.tick(5); // t = (8+5) % 10 = 3
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(3);
  });
});

// ─── seekWithTrail(t, options) ───────────────────────────────────────────────

describe("seekWithTrail(t, options)", () => {
  // All tests use identity (period=10, speed=1) with trailLength=10.
  // Default step = 10/10 = 1. All arithmetic is exact whole numbers.
  const TRAIL = 10;

  it("sets t to the target value", () => {
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(5);
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(5); // x = t = 5
  });

  it("sets actualTime to target / speed", () => {
    const engine = createEngine(identity, TRAIL); // speed=1
    engine.seekWithTrail(5); // targetTime = 5 / 1 = 5
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.y).toBe(5); // y = actualTime = 5
  });

  it("sets actualTime to target / speed (speed > 1)", () => {
    const fast: CurveDef = { ...identity, speed: 2 };
    const engine = createEngine(fast, TRAIL);
    engine.seekWithTrail(4); // targetTime = 4 / 2 = 2
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.y).toBe(2); // y = actualTime = 2
  });

  it("wraps targetT >= period into [0, period)", () => {
    const engine = createEngine(identity, TRAIL); // period=10
    engine.seekWithTrail(15); // 15 % 10 = 5
    const trail = engine.tick(0);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(5);
  });

  it("clears the previous trail before rebuilding", () => {
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(9); // full trail (10 points)
    engine.seekWithTrail(5); // partial trail — old points must not leak through
    expect(engine.trailCount).toBe(6);
  });

  it("trail count is min(trailLength, pointsFromStart) with default step", () => {
    // step=1, advance=1. seekWithTrail(5): pointsFromStart = floor(5/1)+1 = 6
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(5);
    expect(engine.trailCount).toBe(6);
  });

  it("trail count equals trailLength when target is at period * (trailLength-1)/trailLength", () => {
    // seekWithTrail(9): pointsFromStart = floor(9/1)+1 = 10 = trailLength
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(9);
    expect(engine.trailCount).toBe(TRAIL);
  });

  it("trail count is 1 when targetT = 0 (no prior history to reconstruct)", () => {
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(0);
    expect(engine.trailCount).toBe(1);
  });

  it("trail is full with wrap: true regardless of target position", () => {
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(2, { wrap: true }); // near start — would be 3 without wrap
    expect(engine.trailCount).toBe(TRAIL);
  });

  it("custom step produces a deterministic point count", () => {
    const engine = createEngine(identity, TRAIL); // period=10
    // step=2, advance=2. seekWithTrail(6): pointsFromStart = floor(6/2)+1 = 4
    engine.seekWithTrail(6, { step: 2 });
    expect(engine.trailCount).toBe(4);
  });

  it("reconstructed trail oldest point matches first sample", () => {
    // seekWithTrail(5): 6 points. Oldest: sampleT = 5-(5*1)=0, time=0 → fn(0,0)={x:0,y:0}
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(5);
    const trail = engine.tick(0); // peek: adds one more, oldest stays at [0]
    expect(trail[0]!.x).toBe(0);
    expect(trail[0]!.y).toBe(0);
  });

  it("reconstructed trail newest point matches target", () => {
    // seekWithTrail(5): newest = fn(5, 5) = {x:5, y:5}
    // After tick(1): trail[5] is still the reconstructed newest, trail[6] is the tick point
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(5);
    const trail = engine.tick(1); // t=6, actualTime=6 — adds trail[6]
    expect(trail[5]!.x).toBe(5); // last reconstructed point, untouched
    expect(trail[5]!.y).toBe(5);
  });

  it("tick after seekWithTrail continues from the reconstructed position", () => {
    const engine = createEngine(identity, TRAIL);
    engine.seekWithTrail(5); // t=5, actualTime=5
    const trail = engine.tick(2); // t=(5+2)%10=7, actualTime=7
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(7);
    expect(p.y).toBe(7);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("KNOWN: createEngine(curve, 0) throws when tick() is called", () => {
    // CircularBuffer(0) allocates an empty data array. push() immediately dereferences
    // data[0] which is undefined, throwing a TypeError at runtime.
    const engine = createEngine(identity, 0);
    expect(() => engine.tick(1)).toThrow();
  });

  it("KNOWN: getSarmalSkeleton with period < 0.02 produces NaN points", () => {
    // Math.ceil(period * 50) = 1 when period < 0.02, so steps-1 = 0
    // sampleT = (0 / 0) * period = NaN — all skeleton points are NaN
    const tinyPeriod: CurveDef = {
      name: "tiny",
      fn: (t) => ({ x: t, y: t }),
      period: 0.01,
    };
    const engine = createEngine(tinyPeriod);
    const skeleton = engine.getSarmalSkeleton();
    expect(skeleton[0]!.x).toBeNaN();
    expect(skeleton[0]!.y).toBeNaN();
  });

  it("KNOWN: seekWithTrail with wrap:true passes negative t to curve fn when trail reaches back beyond -period", () => {
    // With period=2 and step=0.15, going back 20 steps from t=0.1:
    // sampleT = 0.1 - 19*0.15 = -2.75 which is < -period (-2)
    // The single +period correction gives -0.75 (still negative) — bug
    const captured: number[] = [];
    const short: CurveDef = {
      name: "capture",
      fn: (t, time) => {
        captured.push(t);
        return { x: t, y: time };
      },
      period: 2,
      speed: 1,
    };
    const engine = createEngine(short, 20);
    engine.seekWithTrail(0.1, { wrap: true, step: 0.15 });
    // captured[0] is the t value for the oldest trail point (i=19 in the loop)
    expect(captured[0]).toBeCloseTo(-0.75);
  });

  it("KNOWN: tick(-1) produces negative t (JS modulo returns sign of dividend)", () => {
    // -1 % 10 = -1 in JavaScript (not 9), so t goes negative for negative dt
    const engine = createEngine(identity); // period=10
    const trail = engine.tick(-1);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBe(-1); // x = t = -1
  });

  it("KNOWN: period: 0 causes NaN in tick() output", () => {
    // t = (0 + 1*1) % 0 = NaN — any modulo by zero is NaN in JS
    const zeroPeriod: CurveDef = {
      name: "zero",
      fn: (t) => ({ x: t, y: t }),
      period: 0,
    };
    const engine = createEngine(zeroPeriod);
    const trail = engine.tick(1);
    const p = lastPoint(trail, engine.trailCount);
    expect(p.x).toBeNaN();
    expect(p.y).toBeNaN();
  });

  it("KNOWN: period: 0 in seekWithTrail silently produces 0 trail points", () => {
    // step=0, advance=0, target=NaN → pointsFromStart=NaN → count=NaN
    // Loop condition NaN >= 0 is false — loop never runs, trail stays empty
    const zeroPeriod: CurveDef = {
      name: "zero",
      fn: (t) => ({ x: t, y: t }),
      period: 0,
    };
    const engine = createEngine(zeroPeriod);
    engine.seekWithTrail(0);
    expect(engine.trailCount).toBe(0);
  });
});

// ─── getSarmalSkeleton() ─────────────────────────────────────────────────────

describe("getSarmalSkeleton()", () => {
  it("returns Math.ceil(period * 50) points", () => {
    const engine = createEngine(circle);
    const skeleton = engine.getSarmalSkeleton();
    expect(skeleton.length).toBe(Math.ceil(TWO_PI * 50)); // 315
  });

  it("first point matches fn(0, 0, {})", () => {
    const engine = createEngine(circle);
    const skeleton = engine.getSarmalSkeleton();
    expect(skeleton[0]!.x).toBeCloseTo(Math.cos(0)); // 1
    expect(skeleton[0]!.y).toBeCloseTo(Math.sin(0)); // 0
  });

  it("last point matches fn(period, 0, {})", () => {
    const engine = createEngine(circle);
    const skeleton = engine.getSarmalSkeleton();
    const last = skeleton[skeleton.length - 1]!;
    expect(last.x).toBeCloseTo(Math.cos(TWO_PI)); // ≈ 1
    expect(last.y).toBeCloseTo(Math.sin(TWO_PI)); // ≈ 0
  });

  it("all points are sampled with time = 0", () => {
    // identity curve: y = time — all skeleton y values must be 0
    const engine = createEngine(identity);
    const skeleton = engine.getSarmalSkeleton();
    for (const point of skeleton) {
      expect(point.y).toBe(0);
    }
  });

  it("returns a new array on each call — not the mutable trail buffer", () => {
    const engine = createEngine(circle);
    const s1 = engine.getSarmalSkeleton();
    const s2 = engine.getSarmalSkeleton();
    expect(s1).not.toBe(s2);
  });

  it("is not affected by tick() calls — skeleton is always sampled at time=0", () => {
    const engine = createEngine(circle);
    const before = engine.getSarmalSkeleton();
    for (let i = 0; i < 100; i++) engine.tick(0.1);
    const after = engine.getSarmalSkeleton();
    expect(before[0]!.x).toBeCloseTo(after[0]!.x);
    expect(before[0]!.y).toBeCloseTo(after[0]!.y);
    expect(before[before.length - 1]!.x).toBeCloseTo(after[after.length - 1]!.x);
  });
});
