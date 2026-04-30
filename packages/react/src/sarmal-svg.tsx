"use client";
import type { SarmalSVGProps } from "./types";

import { useEffect, memo } from "react";
import { useSarmalSVG } from "./use-sarmal-svg";
import { useRenderOptions } from "./use-render-options";

const SarmalSVGInner = ({
  curve,
  className,
  style,
  trailColor,
  morphDuration,
  onReady,
  skeletonColor,
  headColor,
  trailStyle,
  headRadius,
  trailLength,
  autoStart,
  initialT,
}: SarmalSVGProps) => {
  const { svgRef, instance } = useSarmalSVG(
    curve,
    {
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(trailColor !== undefined && { trailColor }),
      ...(headColor !== undefined && { headColor }),
      ...(trailStyle !== undefined && { trailStyle }),
    },
    {
      ...(headRadius !== undefined && { headRadius }),
      ...(trailLength !== undefined && { trailLength }),
      ...(autoStart !== undefined && { autoStart }),
      ...(initialT !== undefined && { initialT }),
    },
    morphDuration !== undefined ? { morphDuration } : undefined,
  );

  useRenderOptions(instance, trailColor, skeletonColor, headColor, trailStyle);

  useEffect(() => {
    if (instance.current) {
      onReady?.(instance.current);
    }
  }, []);

  return <svg ref={svgRef} className={className} style={style} />;
};

export const SarmalSVG = memo(SarmalSVGInner);
export type { SarmalSVGProps };
