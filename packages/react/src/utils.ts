import type { TrailColor } from "@sarmal/core";

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
