import type {
  SarmalInstance,
  DotMatrixRuntimeRenderOptions,
  BaseInit,
  CanvasInit,
  DotMatrixInit,
  BaseSarmalOptions,
  BaseDotMatrixOptions,
} from "@sarmal/core";

export type { BaseInit, CanvasInit, DotMatrixInit };

/**
 * Shared base for all Svelte Sarmal component props.
 * Extends the framework-agnostic {@link BaseSarmalOptions} with Svelte-specific surface.
 */
export interface BaseSarmalProps extends BaseSarmalOptions {
  class?: string;
  style?: string;
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance | null;
  /** Callback fired when the instance is ready. Fires again if the instance is recreated due to init option changes. */
  onready?: (instance: SarmalInstance) => void;
}

export type SarmalActionOptions = BaseSarmalOptions;

export interface SarmalProps extends BaseSarmalProps {
  width?: number;
  height?: number;
}

export interface SarmalSVGProps extends BaseSarmalProps {}

export type SarmalDotMatrixActionOptions = BaseDotMatrixOptions;

export interface SarmalDotMatrixProps extends BaseDotMatrixOptions {
  class?: string;
  style?: string;
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance<DotMatrixRuntimeRenderOptions> | null;
  width?: number;
  height?: number;
  /** Callback fired when the instance is ready. Fires again if the instance is recreated due to init option changes. */
  onready?: (instance: SarmalInstance<DotMatrixRuntimeRenderOptions>) => void;
}
