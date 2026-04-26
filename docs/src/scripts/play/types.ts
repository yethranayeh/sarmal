import type { Point } from "@sarmal/core";

export const DEFAULT_CODE = `return {
  x: Math.cos(t),
  y: Math.sin(t)
}`;

export interface PresetData {
  id: string;
  name: string;
  fn: string;
  period?: number;
}

export interface Preset {
  fn: string;
  period: number;
}

export type PlaygroundMode = "math" | "draw";

export type CurveFn = (t: number, time: number, params: Record<string, number>) => Point;

export interface SharedState {
  v: 1;
  mode?: "math" | "draw";
  drawPoints?: Array<[number, number]>;
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
