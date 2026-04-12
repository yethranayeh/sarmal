import { bench, describe } from "vitest";
import { createEngine } from "./engine";
import type { CurveDef } from "./types";

const TWO_PI = Math.PI * 2;

const circle: CurveDef = {
  name: "bench-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: TWO_PI,
  speed: 1,
};

describe("tick() throughput", () => {
  bench("trailLength=120 (default)", () => {
    const engine = createEngine(circle, 120);
    engine.tick(1 / 60);
  });

  bench("trailLength=500 (heavy)", () => {
    const engine = createEngine(circle, 500);
    engine.tick(1 / 60);
  });
});

describe("getSarmalSkeleton() throughput", () => {
  bench("2π period (315 samples)", () => {
    const engine = createEngine(circle);
    engine.getSarmalSkeleton();
  });

  bench("6π period (945 samples)", () => {
    const longCurve: CurveDef = { ...circle, period: TWO_PI * 3 };
    const engine = createEngine(longCurve);
    engine.getSarmalSkeleton();
  });
});

describe("seek() throughput (trail reconstruction)", () => {
  bench("trailLength=120, seek to midpoint", () => {
    const engine = createEngine(circle, 120);
    engine.seek(Math.PI);
  });

  bench("trailLength=500, seek to midpoint", () => {
    const engine = createEngine(circle, 500);
    engine.seek(Math.PI);
  });

  bench("trailLength=500 with wrap:true", () => {
    const engine = createEngine(circle, 500);
    engine.seek(0.1, { wrap: true });
  });
});
