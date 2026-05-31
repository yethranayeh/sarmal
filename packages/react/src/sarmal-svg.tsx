"use client";
import type { SarmalSVGProps } from "./types";

import { useLayoutEffect, memo } from "react";
import { useSarmalSVG } from "./use-sarmal-svg";
import { useRenderOptions } from "./use-render-options";

const SarmalSVGInner = ({
  curve,
  className,
  style,
  trailColor,
  morphDuration,
  morphStrategy,
  morphEasing,
  morphAlign,
  onReady,
  skeletonColor,
  headColor,
  trailStyle,
  headRadius,
  trailLength,
  trailWidth,
  autoStart,
  initialPhase,
  pauseOnHidden,
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
      ...(initialPhase !== undefined && { initialPhase }),
      ...(pauseOnHidden !== undefined && { pauseOnHidden }),
    },
    morphDuration !== undefined ||
      morphStrategy !== undefined ||
      morphEasing !== undefined ||
      morphAlign !== undefined
      ? {
          ...(morphDuration !== undefined && { morphDuration }),
          ...(morphStrategy !== undefined && { morphStrategy }),
          ...(morphEasing !== undefined && { morphEasing }),
          ...(morphAlign !== undefined && { morphAlign }),
        }
      : undefined,
  );

  useRenderOptions(instance, trailColor, skeletonColor, headColor, trailStyle, trailWidth);

  useLayoutEffect(() => {
    if (instance.current) {
      onReady?.(instance.current);
    }
  }, []);

  return <svg ref={svgRef} className={className} style={style} />;
};

export const SarmalSVG = memo(SarmalSVGInner);
export type { SarmalSVGProps };
