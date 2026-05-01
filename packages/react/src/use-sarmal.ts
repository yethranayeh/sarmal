"use client";
import type { CurveDef, SarmalInstance, SarmalOptions } from "@sarmal/core";
import type { CanvasInit, MorphOptions } from "./types";

import { useRef, useEffect } from "react";
import { createSarmal } from "@sarmal/core";
import { useMorphEffect } from "./use-morph";

function resolveCanvasSize(
  canvas: HTMLCanvasElement,
  initWidth?: number,
  initHeight?: number,
): { width: number; height: number } {
  const parent = canvas.parentElement;
  const parentW = parent?.clientWidth ?? 0;
  const parentH = parent?.clientHeight ?? 0;

  const w = initWidth ?? parentW;
  const h = initHeight ?? parentH;

  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }

  console.warn(
    "[sarmal] Could not determine canvas dimensions. The parent container reports 0x0. It needs an explicit height (height: auto won't work). Falling back to 300x300.",
  );
  return { width: 300, height: 300 };
}

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
  useEffect(() => {
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
      ...(init?.initialT !== undefined && { initialT: init.initialT }),
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
    init?.initialT,
  ]);

  return { canvasRef, instance };
}
