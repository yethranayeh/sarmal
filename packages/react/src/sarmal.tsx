"use client";
import type { SarmalProps } from "./types";

import { useEffect, memo } from "react";
import { useSarmal } from "./use-sarmal";
import { useRenderOptions } from "./use-render-options";

const SarmalInner = ({
  curve,
  className,
  style,
  trailColor,
  morphDuration,
  onReady,
  skeletonColor,
  headColor,
  trailStyle,
  width,
  height,
  headRadius,
  trailLength,
  autoStart,
  initialPhase,
}: SarmalProps) => {
  const { canvasRef, instance } = useSarmal(
    curve,
    {
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(trailColor !== undefined && { trailColor }),
      ...(headColor !== undefined && { headColor }),
      ...(trailStyle !== undefined && { trailStyle }),
    },
    {
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
      ...(headRadius !== undefined && { headRadius }),
      ...(trailLength !== undefined && { trailLength }),
      ...(autoStart !== undefined && { autoStart }),
      ...(initialPhase !== undefined && { initialPhase }),
    },
    morphDuration !== undefined ? { morphDuration } : undefined,
  );

  useRenderOptions(instance, trailColor, skeletonColor, headColor, trailStyle);

  useEffect(() => {
    if (instance.current) {
      onReady?.(instance.current);
    }
  }, []);

  return <canvas ref={canvasRef} className={className} style={style} />;
};

export const Sarmal = memo(SarmalInner);
export type { SarmalProps };
