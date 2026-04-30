import type { CurveDef, SarmalInstance, TrailColor, TrailStyle } from "@sarmal/core";
import type { CSSProperties } from "react";

/** Options forwarded to morphTo when the curve prop changes. */
export interface MorphOptions {
  morphDuration?: number;
}

/**
 * Initialization options shared by canvas and SVG renderers
 * Changing any of these after mount destroys and recreates the instance (trail resets).
 */
export interface BaseInit {
  /** @init */
  trailLength?: number;
  /** @init */
  headRadius?: number;
  /** @init */
  autoStart?: boolean;
  /** @init */
  initialT?: number;
}

/**
 * Initialization options for the canvas renderer.
 * Extends {@link BaseInit} with canvas-specific sizing.
 */
export interface CanvasInit extends BaseInit {
  /** @init */
  width?: number;
  /** @init */
  height?: number;
}

/** Props shared by `<Sarmal>` and `<SarmalSVG>`. */
export interface BaseSarmalProps {
  curve: CurveDef;
  className?: string;
  style?: CSSProperties;
  trailColor?: TrailColor;
  skeletonColor?: string;
  headColor?: string;
  trailStyle?: TrailStyle;
  morphDuration?: number;
  onReady?: (instance: SarmalInstance) => void;
  /** changing after mount recreates the instance and resets the trail */
  trailLength?: number;
  /** changing after mount recreates the instance and resets the trail */
  headRadius?: number;
  /** changing after mount recreates the instance and resets the trail */
  autoStart?: boolean;
  /** changing after mount recreates the instance and resets the trail */
  initialT?: number;
}

/** Props for `<Sarmal>`. Extends {@link BaseSarmalProps} with canvas buffer sizing. */
export interface SarmalProps extends BaseSarmalProps {
  /** changing after mount recreates the instance and resets the trail */
  width?: number;
  /** changing after mount recreates the instance and resets the trail */
  height?: number;
}

/** Props for `<SarmalSVG>`. SVG scales naturally via CSS so no `width`/`height` sizing props are needed. */
export type SarmalSVGProps = BaseSarmalProps;
