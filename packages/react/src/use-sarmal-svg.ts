"use client";
import type { CurveDef, SarmalInstance, SVGSarmalOptions } from "@sarmal/core";
import type { BaseInit, MorphOptions } from "./types";

import { useRef, useEffect } from "react";
import { createSarmalSVG } from "@sarmal/core";
import { useMorphEffect } from "./use-morph";

/**
 * React hook for creating and managing a Sarmal SVG instance.
 * Mirrors the lifecycle of {@link useSarmal}
 *  but calls {@link createSarmalSVG} and returns an SVG ref instead of a canvas ref.
 * SVG elements scale with CSS, so width/height are not needed.
 * The renderer sets `viewBox="0 0 100 100"` on the root `<svg>`.
 *
 * @param curve The curve definition to render. Morphs on reference change.
 * @param options Runtime visual options (trailColor, headColor, etc.) which can be updated with setRenderOptions
 * @param init Initial options. Changing any of these destroys and recreates the instance
 * @param morphOptions Options forwarded to morphTo when the curve changes
 * @returns An object with `svgRef` (attach to an `<svg>` element) and `instance` (the live SarmalInstance)
 */
export function useSarmalSVG(
  curve: CurveDef,
  options?: Partial<SVGSarmalOptions>,
  init?: BaseInit,
  morphOptions?: MorphOptions,
): {
  svgRef: React.RefObject<SVGSVGElement | null>;
  instance: React.RefObject<SarmalInstance | null>;
} {
  const svgRef = useRef<SVGSVGElement>(null);
  const instance = useRef<SarmalInstance>(null);
  const committedCurveRef = useMorphEffect(curve, instance, morphOptions);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- curve changes go through morphTo, not recreation
  useEffect(() => {
    const svg = svgRef.current;
    if (svg == null) {
      return;
    }

    instance.current = createSarmalSVG(svg, curve, {
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
  }, [init?.trailLength, init?.headRadius, init?.autoStart, init?.initialT]);

  return { svgRef, instance };
}
