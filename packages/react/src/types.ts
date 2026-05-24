import type {
  MorphStrategy,
  SarmalInstance,
  DotMatrixRuntimeRenderOptions,
  BaseInit,
  CanvasInit,
  DotMatrixInit,
  BaseSarmalOptions,
  BaseDotMatrixOptions,
} from "@sarmal/core";
import type { CSSProperties } from "react";

export type { BaseInit, CanvasInit, DotMatrixInit };

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

/** Props shared by `<Sarmal>` and `<SarmalSVG>`. */
export interface BaseSarmalProps extends BaseSarmalOptions {
  className?: string;
  style?: CSSProperties;
  onReady?: (instance: SarmalInstance) => void;
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

/** Props for `<SarmalDotMatrix>`. */
export interface SarmalDotMatrixProps extends BaseDotMatrixOptions {
  className?: string;
  style?: CSSProperties;
  onReady?: (instance: SarmalInstance<DotMatrixRuntimeRenderOptions>) => void;
  /** Canvas buffer width in pixels. @init */
  width?: number;
  /** Canvas buffer height in pixels. @init */
  height?: number;
}
