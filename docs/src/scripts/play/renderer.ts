import type { SarmalPalette, TrailStyle } from "@sarmal/core";
import type { CurveFn, PlaygroundRenderParams } from "./types";

import { createEngine, palettes, createSVGRenderer } from "@sarmal/core";

export function getResolvedTrailColor(style: TrailStyle, palette: SarmalPalette, color: string) {
  if (style !== "default") {
    return palettes[palette] ?? color;
  }

  return color;
}

export function getResolvedSkeletonColor(
  showSkeleton: boolean,
  style: TrailStyle,
  palette: string,
  color: string,
) {
  if (!showSkeleton) {
    return "transparent";
  }

  if (style !== "default") {
    const p = palettes[palette as SarmalPalette];
    return p ? p[0] : color;
  }
  return color;
}

export function createInstance(
  container: SVGSVGElement,
  fn: CurveFn,
  params: PlaygroundRenderParams,
  period = Math.PI * 2,
) {
  const engine = createEngine(
    { name: "playground", fn, period, speed: params.speed },
    params.trailLength,
  );

  const rendererOptions: Parameters<typeof createSVGRenderer>[0] = {
    container,
    engine,
    trailColor: params.trailColor,
    skeletonColor: params.skeletonColor,
    trailStyle: params.trailStyle,
  };

  if (params.headColor) {
    rendererOptions.headColor = params.headColor;
  }

  if (params.headRadius !== undefined) {
    rendererOptions.headRadius = params.headRadius;
  }

  return createSVGRenderer(rendererOptions);
}
