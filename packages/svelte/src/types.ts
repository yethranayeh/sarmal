import type { CurveDef, TrailColor, TrailStyle, SarmalInstance } from "@sarmal/core";

export interface MorphOptions {
  morphDuration?: number;
  /**
   * Strategy for lerping between curves with different periods.
   * - `'normalized'`: maps phase proportionally into each curve's period (default, works well for all period ratios)
   * - `'raw'`: uses the same phase value for both curves (can produce incoherent results for mismatched periods)
   * @default 'normalized'
   */
  morphStrategy?: "raw" | "normalized";
}

/**
 * ! Changing any of the values from **Init** after mount destroys and recreates the instance
 */
export interface Init {
  trailLength?: number;
  headRadius?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /**
   * Whether to automatically pause the animation when the browser tab is hidden
   *  and resume it when the tab becomes visible again.
   * @default true
   */
  pauseOnHidden?: boolean;
}

/**
 * ! Changing any of the values from **CanvasInit** after mount destroys and recreates the instance
 */
export interface CanvasInit extends Init {
  /** @init Width in CSS pixels */
  width?: number;
  /** @init Height in CSS pixels */
  height?: number;
}

export interface SarmalActionOptions {
  curve: CurveDef;
  trailColor?: TrailColor;
  skeletonColor?: string;
  headColor?: string;
  trailStyle?: TrailStyle;
  morphDuration?: number;
  /** @default 'normalized' */
  morphStrategy?: "raw" | "normalized";
  trailLength?: number;
  headRadius?: number;
  trailWidth?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /** @default true */
  pauseOnHidden?: boolean;
}

export interface SarmalProps {
  curve: CurveDef;
  class?: string;
  style?: string;
  trailColor?: TrailColor;
  skeletonColor?: string;
  headColor?: string;
  trailStyle?: TrailStyle;
  morphDuration?: number;
  /** @default 'normalized' */
  morphStrategy?: "raw" | "normalized";
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance | null;
  trailLength?: number;
  headRadius?: number;
  trailWidth?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /** Changing after mount recreates the instance and resets the trail. @default true */
  pauseOnHidden?: boolean;
  width?: number;
  height?: number;
  /** Callback fired once when the instance is ready */
  onready?: (instance: SarmalInstance) => void;
}

export type SarmalSVGProps = Omit<SarmalProps, "width" | "height">;
