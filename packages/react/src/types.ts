import type {
  CurveDef,
  MorphStrategy,
  SarmalInstance,
  TrailColor,
  TrailStyle,
  DotMatrixRuntimeRenderOptions,
} from "@sarmal/core";
import type { CSSProperties } from "react";

/** Options forwarded to morphTo when the curve prop changes. */
export interface MorphOptions {
  morphDuration?: number;
  /**
   * Strategy for lerping between curves with different periods.
   * - `'normalized'`: maps phase proportionally into each curve's period (default, works well for all period ratios)
   * - `'raw'`: uses the same phase value for both curves (can produce incoherent results for mismatched periods)
   * @default 'normalized'
   */
  morphStrategy?: MorphStrategy;
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
  initialPhase?: number;
  /**
   * Whether to automatically pause the animation when the browser tab is hidden
   *  and resume it when the tab becomes visible again.
   * @init
   * @default true
   */
  pauseOnHidden?: boolean;
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
  /**
   * Strategy for lerping between curves with different periods when the `curve` prop changes.
   * @default 'normalized'
   */
  morphStrategy?: MorphStrategy;
  onReady?: (instance: SarmalInstance) => void;
  /** changing after mount recreates the instance and resets the trail */
  trailLength?: number;
  /** changing after mount recreates the instance and resets the trail */
  headRadius?: number;
  trailWidth?: number;
  /** changing after mount recreates the instance and resets the trail */
  autoStart?: boolean;
  /** changing after mount recreates the instance and resets the trail */
  initialPhase?: number;
  /** changing after mount recreates the instance and resets the trail */
  pauseOnHidden?: boolean;
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

/**
 * Initialization options for the dot matrix renderer.
 * Changing any of these after mount destroys and recreates the instance.
 */
export interface DotMatrixInit {
  /** @default 32 @init */
  cols?: number;
  /** @default 32 @init */
  rows?: number;
  /**
   * Corner rounding of each dot: `0` = sharp square, `1` = full circle.
   * @default 1
   * @init
   */
  roundness?: number;
  /**
   * Number of trail points to keep. Defaults to `cols * 3` (computed by core at construction)
   *
   * If `cols` changes and triggers instance recreation, the new instance uses the new default (`newCols * 3`)
   * If you set `trailLength` explicitly, that value persists across recreations regardless of `cols`
   * @init
   */
  trailLength?: number;
  /** @init */
  autoStart?: boolean;
  /** @init */
  initialPhase?: number;
  /**
   * Whether to automatically pause the animation when the browser tab is hidden
   * and resume it when the tab becomes visible again.
   * @init
   * @default true
   */
  pauseOnHidden?: boolean;
  /** Canvas buffer width in pixels. Falls back to parent `clientWidth`, then 300. @init */
  width?: number;
  /** Canvas buffer height in pixels. Falls back to parent `clientHeight`, then 300. @init */
  height?: number;
}

/** Props for `<SarmalDotMatrix>`. */
export interface SarmalDotMatrixProps {
  curve: CurveDef;
  className?: string;
  style?: CSSProperties;

  trailColor?: TrailColor;
  trailStyle?: TrailStyle;
  skeletonColor?: string;

  morphDuration?: number;
  /** @default 'normalized' */
  morphStrategy?: MorphStrategy;

  onReady?: (instance: SarmalInstance<DotMatrixRuntimeRenderOptions>) => void;

  /** @default 32 @init */
  cols?: number;
  /** @default 32 @init */
  rows?: number;
  /** Corner rounding: 0 = square, 1 = circle. @default 1 @init */
  roundness?: number;
  /**
   * Defaults to `cols * 3`. See {@link DotMatrixInit.trailLength} for details on the `cols` interaction.
   * @init
   */
  trailLength?: number;
  /** @init */
  autoStart?: boolean;
  /** @init */
  initialPhase?: number;
  /** @init @default true */
  pauseOnHidden?: boolean;
  /** Canvas buffer width in pixels. @init */
  width?: number;
  /** Canvas buffer height in pixels. @init */
  height?: number;
}
