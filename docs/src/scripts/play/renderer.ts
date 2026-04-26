import type { TrailStyle } from "@sarmal/core";
import type { CurveFn } from "./types";

import { createEngine, palettes, createRenderer } from "@sarmal/core";

export function getResolvedTrailColor(style: TrailStyle, palette: string, color: string) {
  if (style !== "default") {
    return palettes[palette as keyof typeof palettes] ?? color;
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
    const p = palettes[palette as keyof typeof palettes];
    return p ? p[0] : color;
  }
  return color;
}

export function createInstance(
  canvas: HTMLCanvasElement,
  fn: CurveFn,
  params: {
    trailColor: string | string[];
    skeletonColor: string;
    headColor?: string;
    trailLength: number;
    speed: number;
    trailStyle: TrailStyle;
  },
  period = Math.PI * 2,
) {
  const engine = createEngine(
    { name: "playground", fn, period, speed: params.speed },
    params.trailLength,
  );

  const rendererOptions: Parameters<typeof createRenderer>[0] = {
    canvas,
    engine,
    trailColor: params.trailColor,
    skeletonColor: params.skeletonColor,
    trailStyle: params.trailStyle,
  };

  if (params.headColor) {
    rendererOptions.headColor = params.headColor;
  }

  return createRenderer(rendererOptions);
}
