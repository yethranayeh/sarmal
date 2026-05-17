import type { RuntimeRenderOptions, SarmalOptions, TrailColor } from "@sarmal/core";
import type { CanvasInit, Init } from "./types";

export function shallowEqualTrailColor(
  a: TrailColor | undefined,
  b: TrailColor | undefined,
): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((c, i) => c === b[i]);
  }

  return false;
}

export function initValuesEqual(
  a: CanvasInit | Init | undefined,
  b: CanvasInit | Init | undefined,
): boolean {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return (
    a.trailLength === b.trailLength &&
    a.headRadius === b.headRadius &&
    a.autoStart === b.autoStart &&
    a.initialPhase === b.initialPhase
  );
}

export function canvasInitValuesEqual(
  a: CanvasInit | undefined,
  b: CanvasInit | undefined,
): boolean {
  if (!initValuesEqual(a, b)) {
    return false;
  }

  if (!a || !b) {
    return !a && !b;
  }

  return a.width === b.width && a.height === b.height;
}

export function extractRuntimeOptions(opts: Partial<SarmalOptions>): Partial<RuntimeRenderOptions> {
  const runtime: Partial<RuntimeRenderOptions> = {};
  if (opts.trailColor !== undefined) {
    runtime.trailColor = opts.trailColor;
  }

  if (opts.skeletonColor !== undefined) {
    runtime.skeletonColor = opts.skeletonColor;
  }

  if ("headColor" in opts) {
    runtime.headColor = opts.headColor ?? null;
  }

  if (opts.trailStyle !== undefined) {
    runtime.trailStyle = opts.trailStyle;
  }

  if (opts.trailWidth !== undefined) {
    runtime.trailWidth = opts.trailWidth;
  }

  return runtime;
}

export function resolveCanvasSize(
  canvas: HTMLCanvasElement,
  initWidth?: number,
  initHeight?: number,
): { width: number; height: number } {
  const parent = canvas.parentElement;
  const parentW = parent?.clientWidth ?? 0;
  const parentH = parent?.clientHeight ?? 0;
  const w = initWidth ?? parentW;
  const h = initHeight ?? parentH;
  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }

  console.warn(
    "[sarmal] Could not determine canvas dimensions from parent or props. The parent container must have explicit dimensions. Falling back to 300x300.",
  );
  return { width: 300, height: 300 };
}
