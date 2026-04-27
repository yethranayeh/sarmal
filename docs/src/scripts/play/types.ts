import type { Point, TrailStyle } from "@sarmal/core";
import type { DrawingSegment } from "./catmull-rom";

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

export interface DrawBoardExports {
  getPoints: () => Array<DrawingSegment>;
  clearPoints: () => void;
  rebuildInstance: () => void;
  deletePointAt: (index: number) => void;
}

export interface PlaygroundRenderParams {
  trailColor: string | Array<string>;
  skeletonColor: string;
  headColor?: string;
  trailLength: number;
  speed: number;
  trailStyle: TrailStyle;
}
