"use client";
import type { CurveDef, SarmalInstance, TrailColor, TrailStyle } from "@sarmal/core";
import type { CSSProperties } from "react";

import { useEffect, useRef, memo } from "react";
import { useSarmal } from "./use-sarmal";

function shallowEqualTrailColor(a: TrailColor | undefined, b: TrailColor | undefined) {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((c, i) => c === b[i]);
  }
  return false;
}

interface SarmalProps {
  curve: CurveDef;
  className?: string;
  style?: CSSProperties;
  autoStart?: boolean;
  initialT?: number;
  skeletonColor?: string;
  trailColor?: TrailColor;
  headColor?: string;
  /** Init-only — cannot be changed after mount. */
  headRadius?: number;
  trailStyle?: TrailStyle;
  morphDuration?: number;
  onReady?: (instance: SarmalInstance) => void;
}

const SarmalInner = ({
  curve,
  className,
  style,
  trailColor,
  morphDuration,
  onReady,
  autoStart,
  initialT,
  skeletonColor,
  headColor,
  headRadius,
  trailStyle,
}: SarmalProps) => {
  const { canvasRef, instance } = useSarmal(
    curve,
    {
      ...(autoStart !== undefined && { autoStart }),
      ...(initialT !== undefined && { initialT }),
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(trailColor !== undefined && { trailColor }),
      ...(headColor !== undefined && { headColor }),
      ...(headRadius !== undefined && { headRadius }),
      ...(trailStyle !== undefined && { trailStyle }),
    },
    morphDuration !== undefined ? { morphDuration } : undefined,
  );

  const prevTrailColorRef = useRef<TrailColor | undefined>(trailColor);
  const prevSkeletonColorRef = useRef<string | undefined>(skeletonColor);
  const prevHeadColorRef = useRef<string | undefined>(headColor);
  const prevTrailStyleRef = useRef<TrailStyle | undefined>(trailStyle);

  useEffect(() => {
    if (instance.current) {
      onReady?.(instance.current);
    }
  }, []);

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

    if (skeletonColor !== prevSkeletonColorRef.current && skeletonColor !== undefined) {
      sarmal.setRenderOptions({ skeletonColor });
      prevSkeletonColorRef.current = skeletonColor;
    }
  }, [skeletonColor]);

  useEffect(() => {
    const sarmal = instance.current;
    if (!sarmal) {
      return;
    }

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

    if (trailStyle !== prevTrailStyleRef.current && trailStyle !== undefined) {
      inst.setRenderOptions({ trailStyle });
      prevTrailStyleRef.current = trailStyle;
    }
  }, [trailStyle]);

  return <canvas ref={canvasRef} className={className} style={style} />;
};

export const Sarmal = memo(SarmalInner);
