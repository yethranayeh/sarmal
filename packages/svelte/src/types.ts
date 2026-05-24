import type {
  CurveDef,
  MorphStrategy,
  TrailColor,
  TrailStyle,
  SarmalInstance,
  DotMatrixRuntimeRenderOptions,
} from "@sarmal/core";

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

/**
 * Shared base for all sarmal renderer configuration options.
 * Extend this to add renderer-specific fields (component props, sizing, etc.).
 */
export interface BaseSarmalProps {
  curve: CurveDef;
  trailColor?: TrailColor;
  skeletonColor?: string;
  headColor?: string;
  trailStyle?: TrailStyle;
  morphDuration?: number;
  /** @default 'normalized' */
  morphStrategy?: MorphStrategy;
  trailLength?: number;
  headRadius?: number;
  trailWidth?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /** @default true */
  pauseOnHidden?: boolean;
}

export interface SarmalActionOptions extends BaseSarmalProps {}

export interface SarmalProps extends BaseSarmalProps {
  class?: string;
  style?: string;
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance | null;
  width?: number;
  height?: number;
  /** Callback fired when the instance is ready. Fires again if the instance is recreated due to init option changes. */
  onready?: (instance: SarmalInstance) => void;
}

export interface SarmalSVGProps extends BaseSarmalProps {
  class?: string;
  style?: string;
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance | null;
  /** Callback fired when the instance is ready. Fires again if the instance is recreated due to init option changes. */
  onready?: (instance: SarmalInstance) => void;
}

/**
 * ! Changing any of the values from **DotMatrixInit** after mount destroys and recreates the instance.
 */
export interface DotMatrixInit {
  /** @default 32 */
  cols?: number;
  /** @default 32 */
  rows?: number;
  /**
   * Corner rounding of each dot: `0` = sharp square, `1` = full circle.
   * @default 1
   */
  roundness?: number;
  /**
   * Number of trail points to keep. Defaults to `cols * 3` (computed by core at construction).
   *
   * If `cols` changes and triggers recreation, the new instance uses the new default (`newCols * 3`).
   * If you set `trailLength` explicitly, that value persists across recreations regardless of `cols`.
   */
  trailLength?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /** @default true */
  pauseOnHidden?: boolean;
  width?: number;
  height?: number;
}

export interface SarmalDotMatrixActionOptions {
  curve: CurveDef;
  // Runtime visual options
  trailColor?: TrailColor;
  trailStyle?: TrailStyle;
  skeletonColor?: string;
  // Morph
  morphDuration?: number;
  /** @default 'normalized' */
  morphStrategy?: MorphStrategy;
  // Init options: changing any of these triggers destroy + recreate
  /** @default 32 */
  cols?: number;
  /** @default 32 */
  rows?: number;
  /** @default 1 */
  roundness?: number;
  trailLength?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /** @default true */
  pauseOnHidden?: boolean;
}

export interface SarmalDotMatrixProps {
  curve: CurveDef;
  class?: string;
  style?: string;
  // Runtime visual options
  trailColor?: TrailColor;
  trailStyle?: TrailStyle;
  skeletonColor?: string;
  // Morph
  morphDuration?: number;
  /** @default 'normalized' */
  morphStrategy?: MorphStrategy;
  /** Bindable instance which can be used with `bind:instance` to get the live `SarmalInstance` */
  instance?: SarmalInstance<DotMatrixRuntimeRenderOptions> | null;
  // Init options — changing any of these recreates the instance
  /** @default 32 */
  cols?: number;
  /** @default 32 */
  rows?: number;
  /** Corner rounding: 0 = square, 1 = circle. @default 1 */
  roundness?: number;
  /**
   * Defaults to `cols * 3`. See {@link DotMatrixInit.trailLength} for details on the `cols` interaction.
   */
  trailLength?: number;
  autoStart?: boolean;
  initialPhase?: number;
  /** Changing after mount recreates the instance. @default true */
  pauseOnHidden?: boolean;
  width?: number;
  height?: number;
  /** Callback fired when the instance is ready. Fires again if the instance is recreated due to init option changes. */
  onready?: (instance: SarmalInstance<DotMatrixRuntimeRenderOptions>) => void;
}
