import type { TrailStyle } from "@sarmal/core";
import type { CurveFn } from "./state";

import { createEngine, palettes, createRenderer } from "@sarmal/core";

import {
  colorInput,
  headColorAutoCheckbox,
  headColorInput,
  paletteSelect,
  previewCanvas,
  speedSlider,
  trailSlider,
  trailStyleSelect,
} from "./dom";
import { state } from "./state";
import { buildCurveFn } from "./curve";

export function getResolvedTrailColor() {
  const style = trailStyleSelect.value as TrailStyle;
  if (style !== "default") {
    return palettes[paletteSelect.value as keyof typeof palettes] ?? colorInput.value;
  }
  return colorInput.value;
}

export function getResolvedSkeletonColor() {
  if (!state.showSkeleton) {
    return "transparent";
  }

  const style = trailStyleSelect.value as TrailStyle;

  if (style !== "default") {
    const palette = palettes[paletteSelect.value as keyof typeof palettes];
    return palette ? palette[0] : colorInput.value;
  }
  return colorInput.value;
}

export const getParams = () => ({
  trailColor: colorInput.value,
  skeletonColor: getResolvedSkeletonColor(),
  headColor: headColorAutoCheckbox.checked ? undefined : headColorInput.value,
  headColorAuto: headColorAutoCheckbox.checked,
  trailLength: parseInt(trailSlider.value, 10),
  speed: parseFloat(speedSlider.value),
  trailStyle: trailStyleSelect.value as TrailStyle,
  palette: paletteSelect.value as "bard" | "sunset" | "ocean" | "ice" | "fire" | "forest",
});

export function createInstance(
  fn: CurveFn,
  params: ReturnType<typeof getParams>,
  period = Math.PI * 2,
) {
  if (state.currentInstance) {
    state.currentInstance.destroy();
    state.currentInstance = null;
  }

  const engine = createEngine(
    { name: "playground", fn, period, speed: params.speed },
    params.trailLength,
  );

  const resolvedTrailColor = getResolvedTrailColor();

  const rendererOptions: Parameters<typeof createRenderer>[0] = {
    canvas: previewCanvas,
    engine,
    trailColor: resolvedTrailColor,
    skeletonColor: params.skeletonColor,
    trailStyle: params.trailStyle,
  };

  if (params.headColor) {
    rendererOptions.headColor = params.headColor;
  }

  state.currentInstance = createRenderer(rendererOptions);
  state.lastCompiledCode = state.currentCode;
  state.lastCompiledFn = fn;
}

export function updateSpeed(speed: number) {
  state.currentInstance?.setSpeed(speed);
}

export function updateTrailLength() {
  const fn = buildCurveFn(state.currentCode);
  if (fn) {
    createInstance(fn, getParams());
  }
}
