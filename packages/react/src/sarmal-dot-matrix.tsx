"use client";
import type { SarmalDotMatrixProps } from "./types";

import { useLayoutEffect, memo } from "react";
import { useSarmalDotMatrix } from "./use-sarmal-dot-matrix";
import { useDotMatrixRenderOptions } from "./use-dot-matrix-render-options";

const SarmalDotMatrixInner = ({
  curve,
  className,
  style,
  trailColor,
  trailStyle,
  skeletonColor,
  gridColor,
  morphDuration,
  morphStrategy,
  morphEasing,
  morphAlign,
  onReady,
  cols,
  rows,
  roundness,
  trailLength,
  width,
  height,
  autoStart,
  initialPhase,
  pauseOnHidden,
}: SarmalDotMatrixProps) => {
  const { canvasRef, instance } = useSarmalDotMatrix(
    curve,
    {
      ...(trailColor !== undefined && { trailColor }),
      ...(trailStyle !== undefined && { trailStyle }),
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(gridColor !== undefined && { gridColor }),
    },
    {
      ...(cols !== undefined && { cols }),
      ...(rows !== undefined && { rows }),
      ...(roundness !== undefined && { roundness }),
      ...(trailLength !== undefined && { trailLength }),
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
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

  useDotMatrixRenderOptions(instance, trailColor, trailStyle, skeletonColor, gridColor);

  useLayoutEffect(() => {
    if (instance.current) {
      onReady?.(instance.current);
    }
  }, []);

  return <canvas ref={canvasRef} className={className} style={style} />;
};

export const SarmalDotMatrix = memo(SarmalDotMatrixInner);
export type { SarmalDotMatrixProps };
