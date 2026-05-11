import { describe, it, expect } from "vitest";
import { curves } from "./curves";
import type { CurveName } from "./curves";
import { createEngine } from "./engine";
import type { CurveDef } from "./types";

const TWO_PI = Math.PI * 2;

describe("curves regression suite", () => {
  const curveNames = Object.keys(curves) as CurveName[];

  for (const name of curveNames) {
    it(`${name}: returns finite values across 100 sampled points`, () => {
      const curve = curves[name]!;
      const period = curve.period ?? TWO_PI;
      const steps = 100;
      for (let i = 0; i <= steps; i++) {
        const phase = (i / steps) * period;
        const elapsed = phase / (curve.speed ?? 1);
        const point = curve.fn(phase, elapsed, {});
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    });
  }
});

describe("curve key lookup", () => {
  const curveNames = Object.keys(curves) as CurveName[];

  for (const name of curveNames) {
    it(`key "${name}" is lowercase and findable`, () => {
      expect(name).toBe(name.toLowerCase());
      const key = curveNames.find((k) => k.toLowerCase() === name.toLowerCase());
      expect(key).toBe(name);
    });
  }

  it("unknown name returns undefined", () => {
    expect(curveNames.find((k) => k.toLowerCase() === "nonexistent")).toBeUndefined();
    expect(curveNames.find((k) => k.toLowerCase() === "")).toBeUndefined();
  });

  it("display names do not match keys", () => {
    expect(curveNames.find((k) => k.toLowerCase() === "rose (n=3)")).toBeUndefined();
    expect(curveNames.find((k) => k.toLowerCase() === "star (4-arm)")).toBeUndefined();
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
