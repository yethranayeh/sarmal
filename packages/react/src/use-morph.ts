"use client";
import type { CurveDef, SarmalInstance } from "@sarmal/core";
import type { MorphOptions } from "./types";

import { useRef, useEffect } from "react";

/**
 * Creates a `committedCurveRef` and registers a morph effect that calls
 * `morphTo` when the `curve` reference changes.
 *
 * ! Callers must write `committedCurveRef.current = curve` in their init effect right after `createSarmal` / `createSarmalSVG`
 * This syncs the `ref` with the initial curve so the morph effect doesn't fire unnecessarily
 *  when init deps and `curve` change at the same time.
 *
 * On initial mount and StrictMode remounts the `ref` already equals `curve`,
 *  so no morph is triggered.
 */
export function useMorphEffect(
  curve: CurveDef,
  instance: React.RefObject<SarmalInstance | null>,
  morphOptions: MorphOptions | undefined,
): React.RefObject<CurveDef> {
  const committedCurveRef = useRef<CurveDef>(curve);
  const morphOptionsRef = useRef<MorphOptions | undefined>(morphOptions);
  morphOptionsRef.current = morphOptions;

  useEffect(() => {
    if (curve === committedCurveRef.current) {
      return;
    }

    committedCurveRef.current = curve;

    if (instance.current == null) {
      return;
    }

    const opts =
      morphOptionsRef.current?.morphDuration != null
        ? { duration: morphOptionsRef.current.morphDuration }
        : undefined;

    instance.current.morphTo(curve, opts).catch(() => {});
  }, [curve]);

  return committedCurveRef;
}
