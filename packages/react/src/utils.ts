import type { TrailColor } from "@sarmal/core";

export function resolveCanvasSize(
  canvas: HTMLCanvasElement,
  initWidth?: number,
  initHeight?: number,
) {
  const parent = canvas.parentElement;
  const parentW = parent?.clientWidth ?? 0;
  const parentH = parent?.clientHeight ?? 0;

  const w = initWidth ?? parentW;
  const h = initHeight ?? parentH;

  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }

  console.warn(
    "[sarmal] Could not determine canvas dimensions. The parent container reports 0x0. It needs an explicit height (height: auto won't work). Falling back to 300x300.",
  );
  return { width: 300, height: 300 };
}

export function shallowEqualTrailColor(a: TrailColor | undefined, b: TrailColor | undefined) {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((c, i) => c === b[i]);
  }
  return false;
}
