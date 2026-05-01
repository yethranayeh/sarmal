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
): void {
  const prevTrailColorRef = useRef<TrailColor | undefined>(trailColor);
  const prevSkeletonColorRef = useRef<string | undefined>(skeletonColor);
  const prevHeadColorRef = useRef<string | undefined>(headColor);
  const prevTrailStyleRef = useRef<TrailStyle | undefined>(trailStyle);

  useEffect(() => {
    const sarmal = instance.current;
    if (sarmal == null) {
      return;
    }

    if (!shallowEqualTrailColor(trailColor, prevTrailColorRef.current)) {
      if (trailColor !== undefined) {
        sarmal.setRenderOptions({ trailColor });
      }
      prevTrailColorRef.current = trailColor;
    }
  }, [trailColor]);

  useEffect(() => {
    const sarmal = instance.current;
    if (!sarmal) {
      return;
    }

    if (skeletonColor !== prevSkeletonColorRef.current) {
      if (skeletonColor !== undefined) {
        sarmal.setRenderOptions({ skeletonColor });
      }
      prevSkeletonColorRef.current = skeletonColor;
    }
  }, [skeletonColor]);

  useEffect(() => {
    const sarmal = instance.current;
    if (!sarmal) {
      return;
    }

    /**
     * ! null is the core API signal for "derive headColor from trailColor"
     * removing the prop (undefined → null) has the same effect as explicitly passing null
     */
    if (headColor !== prevHeadColorRef.current) {
      sarmal.setRenderOptions({ headColor: headColor ?? null });
      prevHeadColorRef.current = headColor;
    }
  }, [headColor]);

  useEffect(() => {
    const inst = instance.current;
    if (!inst) {
      return;
    }

    if (trailStyle !== prevTrailStyleRef.current) {
      if (trailStyle !== undefined) {
        inst.setRenderOptions({ trailStyle });
      }
      prevTrailStyleRef.current = trailStyle;
    }
  }, [trailStyle]);
}
