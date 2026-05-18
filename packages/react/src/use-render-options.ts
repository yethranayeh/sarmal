"use client";
import type { SarmalInstance, TrailColor, TrailStyle } from "@sarmal/core";
import type React from "react";

import { useRef, useEffect } from "react";
import { shallowEqualTrailColor } from "./utils";

export function useRenderOptions(
  instance: React.RefObject<SarmalInstance | null>,
  trailColor: TrailColor | undefined,
  skeletonColor: string | undefined,
  headColor: string | undefined,
  trailStyle: TrailStyle | undefined,
  trailWidth: number | undefined,
): void {
  const initializedRef = useRef(false);
  // TrailColor can be an object (array). Shallow equality check would avoid unexpected setRenderOptions calls
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
      // null is the core API signal for "derive headColor from trailColor"
      headColor: headColor ?? null,
      ...(trailStyle !== undefined && { trailStyle }),
      ...(trailWidth !== undefined && { trailWidth }),
    });
  }, [trailColor, skeletonColor, headColor, trailStyle, trailWidth]);
}
