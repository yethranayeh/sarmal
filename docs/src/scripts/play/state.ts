import type { Point, createRenderer } from "@sarmal/core";

export type CurveFn = (t: number, time: number, params: Record<string, number>) => Point;

export interface SharedState {
  v: 1;
  code: string;
  trailStyle: string;
  palette: string;
  trailColor: string;
  headColor: string;
  headColorAuto: boolean;
  trailLength: number;
  speed: number;
  showSkeleton: boolean;
}

export const DEFAULT_CODE = `return {
  x: Math.cos(t),
  y: Math.sin(t)
}`;

export const state = {
  currentInstance: null as ReturnType<typeof createRenderer> | null,
  showSkeleton: true,
  currentCode: DEFAULT_CODE,
  lastCompiledCode: "",
  lastCompiledFn: null as CurveFn | null,
  debounceTimer: null as ReturnType<typeof setTimeout> | null,
};
