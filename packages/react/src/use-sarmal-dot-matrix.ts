"use client";
import type {
  CurveDef,
  SarmalInstance,
  DotMatrixSarmalOptions,
  DotMatrixRuntimeRenderOptions,
  DotMatrixInit,
} from "@sarmal/core";
import type { MorphOptions } from "./types";

import { useRef, useLayoutEffect } from "react";
import { createSarmalDotMatrix } from "@sarmal/core";
import { useMorphEffect } from "./use-morph";
import { resolveCanvasSize } from "./utils";

/**
 * React hook for creating and managing a Sarmal dot matrix instance.
 * Mirrors the lifecycle of `useSarmal` but calls {@link createSarmalDotMatrix}.
 *
 * @param curve The curve definition to render. Morphs on reference change.
 * @param options Runtime visual options forwarded at creation.
 * @param init Initialization options. Changing any of these destroys and recreates the instance.
 * @param morphOptions Options forwarded to morphTo when the curve changes.
 */
export function useSarmalDotMatrix(
  curve: CurveDef,
  options?: Partial<DotMatrixSarmalOptions>,
  init?: DotMatrixInit,
  morphOptions?: MorphOptions,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instance = useRef<SarmalInstance<DotMatrixRuntimeRenderOptions>>(null);
  const committedCurveRef = useMorphEffect(curve, instance, morphOptions);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- curve changes go through morphTo, not recreation
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }

    const { width, height } = resolveCanvasSize(canvas, init?.width, init?.height);
    canvas.width = width;
    canvas.height = height;

    instance.current = createSarmalDotMatrix(canvas, curve, {
      ...options,
      ...(init?.cols !== undefined && { cols: init.cols }),
      ...(init?.rows !== undefined && { rows: init.rows }),
      ...(init?.roundness !== undefined && { roundness: init.roundness }),
      ...(init?.trailLength !== undefined && { trailLength: init.trailLength }),
      ...(init?.autoStart !== undefined && { autoStart: init.autoStart }),
      ...(init?.initialPhase !== undefined && { initialPhase: init.initialPhase }),
      ...(init?.pauseOnHidden !== undefined && { pauseOnHidden: init.pauseOnHidden }),
    });
    committedCurveRef.current = curve;
    return () => {
      instance.current?.destroy();
      instance.current = null;
    };
  }, [
    init?.width,
    init?.height,
    init?.cols,
    init?.rows,
    init?.roundness,
    init?.trailLength,
    init?.autoStart,
    init?.initialPhase,
    init?.pauseOnHidden,
  ]);

  return { canvasRef, instance };
}
