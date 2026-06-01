import type { DotMatrixRuntimeRenderOptions } from "@sarmal/core";
import type { SarmalDotMatrixActionOptions } from "./types";

import { createSarmalDotMatrix } from "@sarmal/core";
import { shallowEqualTrailColor } from "./utils";

function buildOptions(opts: SarmalDotMatrixActionOptions) {
  return {
    ...(opts.trailColor !== undefined && { trailColor: opts.trailColor }),
    ...(opts.trailStyle !== undefined && { trailStyle: opts.trailStyle }),
    ...(opts.skeletonColor !== undefined && { skeletonColor: opts.skeletonColor }),
    ...(opts.gridColor !== undefined && { gridColor: opts.gridColor }),
    ...(opts.cols !== undefined && { cols: opts.cols }),
    ...(opts.rows !== undefined && { rows: opts.rows }),
    ...(opts.roundness !== undefined && { roundness: opts.roundness }),
    ...(opts.trailLength !== undefined && { trailLength: opts.trailLength }),
    ...(opts.autoStart !== undefined && { autoStart: opts.autoStart }),
    ...(opts.initialPhase !== undefined && { initialPhase: opts.initialPhase }),
    ...(opts.pauseOnHidden !== undefined && { pauseOnHidden: opts.pauseOnHidden }),
  };
}

function initOptionsChanged(
  prev: SarmalDotMatrixActionOptions,
  next: SarmalDotMatrixActionOptions,
) {
  return (
    prev.cols !== next.cols ||
    prev.rows !== next.rows ||
    prev.roundness !== next.roundness ||
    prev.trailLength !== next.trailLength ||
    prev.autoStart !== next.autoStart ||
    prev.initialPhase !== next.initialPhase ||
    prev.pauseOnHidden !== next.pauseOnHidden
  );
}

function diffRenderOptions(
  prev: SarmalDotMatrixActionOptions,
  next: SarmalDotMatrixActionOptions,
): Partial<DotMatrixRuntimeRenderOptions> {
  const changes: Partial<DotMatrixRuntimeRenderOptions> = {};

  if (!shallowEqualTrailColor(prev.trailColor, next.trailColor)) {
    if (next.trailColor !== undefined) {
      changes.trailColor = next.trailColor;
    }
  }

  if (prev.skeletonColor !== next.skeletonColor) {
    if (next.skeletonColor !== undefined) {
      changes.skeletonColor = next.skeletonColor;
    }
  }

  if (prev.trailStyle !== next.trailStyle) {
    if (next.trailStyle !== undefined) {
      changes.trailStyle = next.trailStyle;
    }
  }

  if (prev.gridColor !== next.gridColor) {
    if (next.gridColor !== undefined) {
      changes.gridColor = next.gridColor;
    }
  }

  return changes;
}

/**
 * Svelte action that attaches a sarmal dot matrix animation to a `<canvas>` element.
 *
 * Usage:
 * ```svelte
 * <canvas width={200} height={200} use:sarmalDotMatrix={{ curve, trailColor: '#2dd4bf' }} />
 * ```
 *
 * The action responds to option changes through its `update` callback:
 * - Init-time options (`cols`, `rows`, `roundness`, `trailLength`, `autoStart`, `initialPhase`, `pauseOnHidden`) trigger destroy + recreate
 * - The `curve` option triggers `morphTo`, which preserves the trail
 * - Runtime visual options (`trailColor`, `trailStyle`, `skeletonColor`, `gridColor`) trigger `setRenderOptions` without recreating
 *
 * Note: `headColor`, `headRadius`, and `trailWidth` are not supported by the dot matrix renderer.
 */
export function sarmalDotMatrix(node: HTMLCanvasElement, options: SarmalDotMatrixActionOptions) {
  let instance = createSarmalDotMatrix(node, options.curve, buildOptions(options));
  let prevOpts = options;

  return {
    update(newOpts: SarmalDotMatrixActionOptions) {
      if (initOptionsChanged(prevOpts, newOpts)) {
        instance.destroy();
        instance = createSarmalDotMatrix(node, newOpts.curve, buildOptions(newOpts));
        prevOpts = newOpts;
        return;
      }

      if (prevOpts.curve !== newOpts.curve) {
        instance
          .morphTo(newOpts.curve, {
            ...(newOpts.morphDuration != null && { duration: newOpts.morphDuration }),
            ...(newOpts.morphStrategy != null && { morphStrategy: newOpts.morphStrategy }),
            ...(newOpts.morphEasing != null && { easing: newOpts.morphEasing }),
            ...(newOpts.morphAlign != null && { align: newOpts.morphAlign }),
          })
          .catch(() => {});
      }

      const renderChanges = diffRenderOptions(prevOpts, newOpts);
      if (Object.keys(renderChanges).length > 0) {
        instance.setRenderOptions(renderChanges);
      }

      prevOpts = newOpts;
    },
    destroy() {
      instance.destroy();
    },
  };
}
