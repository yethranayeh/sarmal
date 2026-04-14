export interface Point {
  x: number;
  y: number;
}

export interface CurveDef {
  name: string;
  /**
   * The parametric function that defines the curve shape.
   * @param t Current position along the curve, in [0, period)
   * @param time Elapsed wall-clock time in seconds — always increasing, never resets on period wrap
   * @param params Named parameter overrides.
   *   Always `{}` today — reserved for the upcoming parameterized-curves feature.
   *   Do NOT remove this parameter; it is intentional forward-compatible plumbing.
   */
  fn: (t: number, time: number, params: Record<string, number>) => Point;
  /**
   * @default (Math.PI * 2)
   */
  period?: number;
  /**
   * @default 1
   */
  speed?: number;
  /**
   * To indicate a compatible library version when providing the curve definitions
   * Intended for potential backwards compatibility scenarios and futureproofing
   */
  version?: number;
  /**
   * Skeleton rendering mode:
   * - 'static': Skeleton is computed once at init from `fn(t, 0)` and cached
   * - 'live': Skeleton is recomputed each frame using `fn(t, actualTime)` specifically for curves whose shape drifts *over time*
   * @default "static"
   */
  skeleton?: "static" | "live";
  /**
   * An **override** function for computing a skeleton independent of `fn`
   * If provided, this function is used instead of `fn` to sample the skeleton,
   *  and the result is cached just like like 'static' mode
   * @param t The parametric time value from `0` to `period`
   * @returns The point on the skeleton at time `t`
   */
  skeletonFn?: (t: number) => Point;
}

export type JumpOptions = {
  /**
   * When true, clears the trail on jump. When false (default), the trail is left as-is.
   * @default false
   */
  clearTrail?: boolean;
};

export type SeekOptions = {
  /**
   * When true, the trail wraps around the period boundary,
   *  which results in a full trail even near `t=0`
   * By default, the trail stops at `t=0`, which results in a partial trail near the start
   * @default false
   */
  wrap?: boolean;
  /**
   * Time gap between each trail point (in same units as `t`)
   * Smaller value means a trail that is more dense
   * @default period / trailLength
   */
  step?: number;
};

export type MorpStrategy = "raw" | "normalized";

/**
 * The shared animation state types
 * Both `Engine` and `SarmalInstance` extend this
 * In the renderer, these are passthroughs
 */
export interface AnimationControls {
  /**
   * Resets the simulation state, clearing the trail and reverting internal time `t` to 0
   * The next call to `tick` will start fresh from the beginning of the curve
   */
  reset(): void;
  /**
   * Instantly moves the head to position `t`.
   *
   * ! Does NOT update `actualTime`.
   *
   * Trail is left untouched by default. You can pass `clearTrail: true` to wipe it.
   * Use for morphing mid-flight or any time you don't need trail context.
   * @param t The position to jump to (will be wrapped into [0, period))
   */
  jump(t: number, options?: JumpOptions): void;
  /**
   * Moves to `t` AND reconstructs the trail as if the animation naturally arrived there from `t=0`
   * Also updates `actualTime` to match. Trail is always rebuilt from scratch
   * Use for initialisation or any jump where you want the trail to look meaningful
   * @param t The position to seek to (will be wrapped into [0, period))
   */
  seek(t: number, options?: SeekOptions): void;
  /**
   * Overrides the animation speed at runtime
   * `0` freezes `t` but the loop keeps running
   * Negative values reverse traversal.
   *
   * ! Does NOT affect a curve's inherent speed given in CurveDef
   * @param speed 0 = freeze, negative = reverse, no upper bound
   */
  setSpeed(speed: number): void;
  /**
   * Returns the *effective speed* the engine is currently using:
   * `userSpeedOverride` if set, otherwise the curve's default speed.
   * This is what `tick()` actually uses
   */
  getSpeed(): number;
  /**
   * Drops the speed override and defers back to the curve's inherent default speed.
   * ! Sets `userSpeedOverride` to `null`
   */
  resetSpeed(): void;
}

export type MorphOptions = {
  /**
   * Duration of the morph transition in milliseconds
   * @default 300
   */
  duration?: number;
  /**
   * Strategy for lerping between curves with different periods:
   * - 'normalized': maps `t` proportionally into each curve's period (smooth for all period ratios)
   * - 'raw': uses the same `t` for both curves (can produce incoherent results for mismatched periods)
   * @default 'normalized'
   */
  morphStrategy?: MorpStrategy;
};

export interface Engine extends AnimationControls {
  /**
   * Advances the Sarmal simulation by the given delta time (dt) in seconds.
   * Internally, this increases the simulation time `t` by `speed * dt`,
   *  wraps `t` at `period`, evaluates the curve's parametric function `fn(t)`,
   *  and appends the new point to the trail.
   * Returns the pre-allocated trail buffer, which has the *same* reference every call
   * ! Do not use `Array.length` to determine size
   * @param deltaTime Delta time in seconds (typically frame time from **requestAnimationFrame** or similar)
   */
  tick(deltaTime: number): Array<Point>;
  /**
   * Number of valid points in the trail buffer returned by the last `tick()` call
   * ! Use this instead of `trail.length`
   */
  readonly trailCount: number;
  /**
   * Returns the *skeleton* of the curve.
   * In technicality, it just represents the complete traversal of the curve over one full period,
   *  which is sampled at points from `t=0` to `t=period`
   *
   * For "static" skeletons, this returns the same array on every call
   * For "live" skeletons, this returns a different array each frame
   * For `skeletonFn` overrides, this returns the skeleton from that function, which is *always* static
   *
   * The number of sample points is automatically derived from the curve's period.
   */
  getSarmalSkeleton(): Array<Point>;
  readonly isLiveSkeleton: boolean;
  /**
   * Begins a smooth transition from the current curve to `target`
   * Saves the current curve as `curveA`, registers `target` as `curveB`, and resets `morphAlpha` to `0`
   *
   * If called while a morph is already in progress,
   *  the interpolated state is frozen and becomes the new `curveA`
   * @param target The curve to transition to
   * @param strategy 'normalized' maps t proportionally into each curve's period (default), 'raw' uses the same t
   */
  startMorph(target: CurveDef, strategy?: MorpStrategy): void;
  /**
   * Sets the interpolation amount between `curveA` and `curveB`.
   * 0 = full curveA
   * 1 = full curveB
   * Called by the renderer each frame as `actualTime` advances
   * @param alpha A value in [0, 1]
   */
  setMorphAlpha(alpha: number): void;
  /**
   * Finalises the morph: `curveB` becomes the new active curve and `morphAlpha` is reset to `null`
   * ! Called by the renderer when alpha reaches `1`
   */
  completeMorph(): void;
  /**
   * Current interpolation progress between `curveA` and `curveB`
   * `null` when no morph is in progress
   */
  readonly morphAlpha: number | null;
}

export interface SarmalInstance extends AnimationControls {
  start(): void;
  stop(): void;
  /** Stops the animation and cleans up resources */
  destroy(): void;
  /**
   * Smoothly transitions from the current curve to `target`.
   * The trail naturally reflects the new curve as new points are added.
   * @param target The curve to transition to
   * @param options.duration How long the morph takes in milliseconds (default: 300)
   * @param options.morphStrategy 'normalized' uses proportional t mapping (default), 'raw' uses same t
   * @returns Promise that resolves when the morph is complete
   */
  morphTo(target: CurveDef, options?: MorphOptions): Promise<void>;
}

/**
 * With 'gradient-animated' the colors cycle along the trail over time
 */
export type TrailStyle = "default" | "gradient-static" | "gradient-animated";
export type PalettePreset = "bard" | "sunset" | "ocean" | "ice" | "fire" | "forest";

export interface RendererOptions {
  /** Target canvas element that will contain the Sarmal */
  canvas: HTMLCanvasElement;
  engine: Engine;
  /**
   * @default '#ffffff'
   */
  skeletonColor?: string;
  /**
   * @default '#ffffff'
   */
  trailColor?: string;
  /**
   * @default '#ffffff'
   */
  headColor?: string;
  /** @default 4 */
  headRadius?: number;
  /**
   * Trail rendering style
   * @default 'default'
   */
  trailStyle?: TrailStyle;
  /**
   * Color palette for gradient trails
   * Can be a preset name or custom array of hex colors.
   * @default 'bard' for animated, 'ice' for static
   */
  palette?: PalettePreset | string[];
}

export interface SarmalOptions extends Omit<RendererOptions, "canvas" | "engine"> {
  /** @default 120 */
  trailLength?: number;
}
