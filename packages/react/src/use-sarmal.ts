"use client";
import type { CurveDef, SarmalInstance, SarmalOptions } from "@sarmal/core";
import type { CanvasInit, MorphOptions } from "./types";

import { useRef, useEffect } from "react";
import { createSarmal } from "@sarmal/core";

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
  /**
   * Tracks which curve the instance was last committed to.
   * Comparing by reference skips morphTo on initial mount and on StrictMode remounts
   *  where the curve ref hasn't *actually* changed.
   */
  const committedCurveRef = useRef<CurveDef>(curve);

  useEffect(() => {
    if (instance.current) {
      instance.current.destroy();
      instance.current = null;
    }

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

  useEffect(() => {
    if (curve === committedCurveRef.current) {
      return;
    }

    committedCurveRef.current = curve;

    if (instance.current == null) {
      return;
    }

    const opts =
      morphOptions?.morphDuration != null ? { duration: morphOptions.morphDuration } : undefined;

    instance.current.morphTo(curve, opts).catch(() => {});
  }, [curve]);

  return { canvasRef, instance };
}
