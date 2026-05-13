import type { SarmalActionOptions } from "./types";

import { createSarmalSVG } from "@sarmal/core";
import { buildOptions, initOptionsChanged, diffRenderOptions } from "./action-shared";

/**
 * Svelte action that attaches a sarmal SVG animation to an `<svg>` element.
 *
 * Usage:
 * ```svelte
 * <svg use:sarmalSVG={{ curve, trailColor: '#fff' }} />
 * ```
 *
 * The action responds to option changes via its `update` callback:
 * - Init-time options (`trailLength`, `headRadius`, `autoStart`, `initialPhase`) trigger destroy + recreate
 * - The `curve` option triggers `morphTo`, which preserves the trail
 * - Runtime visual options (`trailColor`, `skeletonColor`, `headColor`, `trailStyle`) trigger `setRenderOptions` without recreating
 */
export function sarmalSVG(node: SVGSVGElement, options: SarmalActionOptions) {
  let instance = createSarmalSVG(node, options.curve, buildOptions(options));
  let prevOpts = options;

  return {
    update(newOpts: SarmalActionOptions) {
      if (initOptionsChanged(prevOpts, newOpts)) {
        instance.destroy();
        instance = createSarmalSVG(node, newOpts.curve, buildOptions(newOpts));
        prevOpts = newOpts;
        return;
      }

      if (prevOpts.curve !== newOpts.curve) {
        instance
          .morphTo(
            newOpts.curve,
            newOpts.morphDuration != null ? { duration: newOpts.morphDuration } : undefined,
          )
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
