"use client";
import type { SarmalProps } from "./types";

import { useLayoutEffect, memo } from "react";
import { useSarmal } from "./use-sarmal";
import { useRenderOptions } from "./use-render-options";

const SarmalInner = ({
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
  width,
  height,
  headRadius,
  trailLength,
  trailWidth,
  autoStart,
  initialPhase,
  pauseOnHidden,
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

  return <canvas ref={canvasRef} className={className} style={style} />;
};

export const Sarmal = memo(SarmalInner);
export type { SarmalProps };
