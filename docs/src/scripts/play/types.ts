import type { Point, TrailStyle } from "@sarmal/core";

export type DrawingSegment = [number, number];

export const DEFAULT_CODE = `return {
  x: Math.cos(phase),
  y: Math.sin(phase)
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

export type CurveFn = (phase: number, elapsed: number, params: Record<string, number>) => Point;

// ! Must stay in sync with SHARE_STATE_VERSION in functions/api/share.ts
export const SHARE_STATE_VERSION = 3 as const;

export interface SharedState {
  v: typeof SHARE_STATE_VERSION;
  mode?: "math" | "draw";
  drawPoints?: Array<[number, number]>;
  code: string;
  trailStyle: string;
  palette: string;
  trailColor: string;
  headColor: string;
  headColorAuto: boolean;
  headRadius?: number;
  trailWidth?: number;
  trailLength: number;
  speed: number;
  showSkeleton: boolean;
  activePeriod?: number;
}

export interface DrawBoardExports {
  getPoints: () => Array<DrawingSegment>;
  clearPoints: () => void;
  rebuildInstance: () => void;
  deletePointAt: (index: number) => void;
  getSkeleton: () => Array<Point>;
  updatePointAt: (index: number, axis: 0 | 1, value: number) => void;
}

export interface PlaygroundRenderParams {
  trailColor: string | Array<string>;
  skeletonColor: string;
  headColor?: string;
  headRadius?: number;
  trailWidth?: number;
  trailLength: number;
  speed: number;
  trailStyle: TrailStyle;
}
