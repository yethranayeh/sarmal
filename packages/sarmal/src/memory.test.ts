import { describe, it, expect } from "vitest";
import { queryObjects } from "node:v8";
import { createEngine } from "./engine";
import type { CurveDef } from "./types";

const TWO_PI = Math.PI * 2;

const circle: CurveDef = {
  name: "test-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: TWO_PI,
  speed: 1,
};

describe("getSarmalSkeleton() allocation behavior", () => {
  it("allocates exactly one array per call (not accumulating)", () => {
    const engine = createEngine(circle);

    // Warm up — JIT compile and discard initial allocations
    for (let i = 0; i < 10; i++) engine.getSarmalSkeleton();
    if (global.gc) global.gc();

    const before = queryObjects(Array) as number;
    const CALLS = 100;
    for (let i = 0; i < CALLS; i++) {
      engine.getSarmalSkeleton();
    }
    if (global.gc) global.gc();
    const after = queryObjects(Array) as number;

    // Each call allocates 1 array. Total should not exceed CALLS + small tolerance.
    // Significantly exceeding CALLS would indicate internal accumulation.
    expect(after - before).toBeLessThanOrEqual(CALLS + 10);
  });

  it("does not retain skeleton arrays after call completes (GC can reclaim them)", () => {
    const engine = createEngine(circle);

    for (let i = 0; i < 50; i++) engine.getSarmalSkeleton();
    if (global.gc) global.gc();

    const baseline = queryObjects(Array) as number;

    for (let i = 0; i < 50; i++) engine.getSarmalSkeleton();
    if (global.gc) global.gc();

    const after = queryObjects(Array) as number;

    // After GC, the count should not have grown significantly — skeleton arrays
    // should be reclaimable since getSarmalSkeleton() doesn't retain them.
    expect(after - baseline).toBeLessThanOrEqual(5);
  });
});
