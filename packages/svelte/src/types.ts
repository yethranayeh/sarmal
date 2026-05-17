import type { CurveDef, TrailColor, TrailStyle, SarmalInstance } from "@sarmal/core";

export interface MorphOptions {
  morphDuration?: number;
}

/**
 * ! Changing any of the values from **Init** after mount destroys and recreates the instance
 */
export interface Init {
  trailLength?: number;
  headRadius?: number;
  autoStart?: boolean;
  initialPhase?: number;
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
  trailLength?: number;
  headRadius?: number;
  trailWidth?: number;
  autoStart?: boolean;
  initialPhase?: number;
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
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance | null;
  trailLength?: number;
  headRadius?: number;
  trailWidth?: number;
  autoStart?: boolean;
  initialPhase?: number;
  width?: number;
  height?: number;
  /** Callback fired once when the instance is ready */
  onready?: (instance: SarmalInstance) => void;
}

export type SarmalSVGProps = Omit<SarmalProps, "width" | "height">;
