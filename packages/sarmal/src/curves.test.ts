import { describe, it, expect } from "vitest";
import { curves } from "./curves";
import type { CurveName } from "./curves";
import { createEngine } from "./engine";
import type { CurveDef } from "./types";

const TWO_PI = Math.PI * 2;

describe("curves regression suite", () => {
  const curveNames = Object.keys(curves) as CurveName[];

  it("all expected curves are exported", () => {
    expect(curveNames).toHaveLength(10);
    expect(curveNames).toContain("artemis2");
    expect(curveNames).toContain("epitrochoid7");
    expect(curveNames).toContain("astroid");
    expect(curveNames).toContain("deltoid");
    expect(curveNames).toContain("rose5");
    expect(curveNames).toContain("rose3");
    expect(curveNames).toContain("lissajous32");
    expect(curveNames).toContain("lissajous43");
    expect(curveNames).toContain("epicycloid3");
    expect(curveNames).toContain("lame");
  });

  for (const name of curveNames) {
    it(`${name}: returns finite values across 100 sampled points`, () => {
      const curve = curves[name]!;
      const period = curve.period ?? TWO_PI;
      const steps = 100;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * period;
        const time = t / (curve.speed ?? 1);
        const point = curve.fn(t, time, {});
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    });
  }
});

describe("user-defined curves", () => {
  it("curve with period: undefined uses engine default of 2π", () => {
    const custom: CurveDef = {
      name: "custom",
      fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
    };
    const engine = createEngine(custom);
    const skeleton = engine.getSarmalSkeleton();
    expect(skeleton.length).toBe(Math.ceil(TWO_PI * 50));
  });
});
