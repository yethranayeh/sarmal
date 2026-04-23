"use client";
import type { CurveDef, SarmalInstance, SarmalOptions } from "@sarmal/core";

import { useRef, useEffect } from "react";
import { createSarmal } from "@sarmal/core";

interface UseSarmalOptions {
  morphDuration?: number;
}

export function useSarmal(
  curve: CurveDef,
  options?: Partial<SarmalOptions>,
  morphOptions?: UseSarmalOptions,
): {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  instance: React.RefObject<SarmalInstance | null>;
} {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instance = useRef<SarmalInstance>(null);
  /**
   * Tracks which curve the instance was last morphed to
   * Comparing by reference skips morphTo on initial mount and on StrictMode remounts
   *  where the curve ref hasn't *actually* changed
   */
  const committedCurveRef = useRef<CurveDef>(curve);

  useEffect(() => {
    if (instance.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (canvas == null) {
      return;
    }

    instance.current = createSarmal(canvas, curve, options);
    return () => {
      instance.current?.destroy();
      instance.current = null;
    };
  }, []);

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

    instance.current
      .morphTo(curve, opts)
      // ! `.catch()` required: destroy() rejects the pending Promise when it is called during a morph.
      .catch(() => {});
  }, [curve]);

  return { canvasRef, instance };
}
