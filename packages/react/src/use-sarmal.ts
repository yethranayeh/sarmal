"use client";
import type { CurveDef, SarmalInstance, SarmalOptions, CanvasInit } from "@sarmal/core";
import type { MorphOptions } from "./types";

import { useRef, useLayoutEffect } from "react";
import { createSarmal } from "@sarmal/core";
import { useMorphEffect } from "./use-morph";
import { resolveCanvasSize } from "./utils";

export function useSarmal(
  curve: CurveDef,
  options?: Partial<SarmalOptions>,
  init?: CanvasInit,
  morphOptions?: MorphOptions,
): {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  instance: React.RefObject<SarmalInstance | null>;
} {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instance = useRef<SarmalInstance>(null);
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

    instance.current = createSarmal(canvas, curve, {
      ...options,
      ...(init?.trailLength !== undefined && { trailLength: init.trailLength }),
      ...(init?.headRadius !== undefined && { headRadius: init.headRadius }),
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
    init?.trailLength,
    init?.headRadius,
    init?.autoStart,
    init?.initialPhase,
    init?.pauseOnHidden,
  ]);

  return { canvasRef, instance };
}
