import { describe, it, expect } from "vitest";
import { createEngine } from "./engine";
import { curves } from "./curves";

describe("engine", () => {
  it("should create an engine", () => {
    const engine = createEngine(curves.artemis2!);
    expect(engine).toBeDefined();
  });

  it("should return a skeleton with points", () => {
    const engine = createEngine(curves.artemis2!);
    const skeleton = engine.getSarmalSkeleton();
    expect(skeleton.length).toBeGreaterThan(0);
  });
});
