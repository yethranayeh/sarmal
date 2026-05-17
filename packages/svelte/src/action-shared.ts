import type { RuntimeRenderOptions } from "@sarmal/core";
import type { SarmalActionOptions } from "./types";

import { shallowEqualTrailColor } from "./utils";

export function buildOptions(opts: SarmalActionOptions) {
  return {
    ...(opts.trailColor !== undefined && { trailColor: opts.trailColor }),
    ...(opts.skeletonColor !== undefined && { skeletonColor: opts.skeletonColor }),
    ...(opts.headColor !== undefined && { headColor: opts.headColor }),
    ...(opts.trailStyle !== undefined && { trailStyle: opts.trailStyle }),
    ...(opts.trailWidth !== undefined && { trailWidth: opts.trailWidth }),
    ...(opts.trailLength !== undefined && { trailLength: opts.trailLength }),
    ...(opts.headRadius !== undefined && { headRadius: opts.headRadius }),
    ...(opts.autoStart !== undefined && { autoStart: opts.autoStart }),
    ...(opts.initialPhase !== undefined && { initialPhase: opts.initialPhase }),
  };
}

export function initOptionsChanged(prev: SarmalActionOptions, next: SarmalActionOptions): boolean {
  return (
    prev.trailLength !== next.trailLength ||
    prev.headRadius !== next.headRadius ||
    prev.autoStart !== next.autoStart ||
    prev.initialPhase !== next.initialPhase
  );
}

export function diffRenderOptions(
  prev: SarmalActionOptions,
  next: SarmalActionOptions,
): Partial<RuntimeRenderOptions> {
  const changes: Partial<RuntimeRenderOptions> = {};
  if (!shallowEqualTrailColor(prev.trailColor, next.trailColor)) {
    if (next.trailColor !== undefined) changes.trailColor = next.trailColor;
  }

  if (prev.skeletonColor !== next.skeletonColor) {
    if (next.skeletonColor !== undefined) changes.skeletonColor = next.skeletonColor;
  }

  if (prev.headColor !== next.headColor) {
    changes.headColor = next.headColor ?? null;
  }

  if (prev.trailStyle !== next.trailStyle) {
    if (next.trailStyle !== undefined) changes.trailStyle = next.trailStyle;
  }

  if (prev.trailWidth !== next.trailWidth) {
    if (next.trailWidth !== undefined) changes.trailWidth = next.trailWidth;
  }

  return changes;
}
