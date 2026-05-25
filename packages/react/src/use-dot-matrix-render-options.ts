"use client";
import type {
  SarmalInstance,
  DotMatrixRuntimeRenderOptions,
  TrailColor,
  TrailStyle,
} from "@sarmal/core";
import type React from "react";

import { useRef, useEffect } from "react";
import { shallowEqualTrailColor } from "./utils";

/**
 * Calls `setRenderOptions` on a dot matrix instance when runtime visual props change.
 * Only the four options supported by the dot matrix renderer are handled:
 *  `trailColor`, `trailStyle`, `skeletonColor`, and `gridColor`
 *
 * ! `headColor`, `headRadius`, and `trailWidth` are not available on the dot matrix renderer.
 */
export function useDotMatrixRenderOptions(
  instance: React.RefObject<SarmalInstance<DotMatrixRuntimeRenderOptions> | null>,
  trailColor: TrailColor | undefined,
  trailStyle: TrailStyle | undefined,
  skeletonColor: string | undefined,
  gridColor: string | undefined,
) {
  const initializedRef = useRef(false);
  const prevTrailColorRef = useRef<TrailColor | undefined>(trailColor);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    const sarmal = instance.current;
    if (!sarmal) {
      return;
    }

    const trailColorChanged = !shallowEqualTrailColor(trailColor, prevTrailColorRef.current);
    prevTrailColorRef.current = trailColor;

    sarmal.setRenderOptions({
      ...(trailColorChanged && trailColor !== undefined && { trailColor }),
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(trailStyle !== undefined && { trailStyle }),
      ...(gridColor !== undefined && { gridColor }),
    });
  }, [trailColor, skeletonColor, trailStyle, gridColor]);
}
