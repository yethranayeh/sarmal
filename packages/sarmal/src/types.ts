export interface Point {
  x: number;
  y: number;
}

export interface CurveDef {
  name: string;
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

export type SeekOptions = {
  /**
   * Decides whether the sarmal trail should be cleared when `seek` is called
   */
  clearTrail?: boolean;
};

export type SeekWithTrailOptions = {
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

export interface Engine {
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
   * Resets the simulation state, by clearing the trail and reverting internal time `t` to 0.
   * The next call to `tick` will start fresh from the beginning of the curve.
   */
  reset(): void;
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
   * Sets the simulation time `t` directly to the specified value.
   * By default, the trail is preserved
   * @param t The time value to seek to (will be wrapped into [0, period))
   */
  seek(t: number, options?: SeekOptions): void;
  /**
   * Seeks to `t` and rebuilds the trail as if the animation naturally arrived there from `t=0`
   * @param t The time value to seek to (will be wrapped into [0, period))
   */
  seekWithTrail(t: number, options?: SeekWithTrailOptions): void;
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

export interface SarmalInstance {
  start(): void;
  stop(): void;
  /** Resets the engine and clears the trail */
  reset(): void;
  /** Stops the animation and cleans up resources */
  destroy(): void;
  // FIXME: JSDoc repetition of proxied functions (maybe use `extend`?)
  /**
   * Sets the simulation time `t` directly to the specified value.
   * By default, the trail is preserved
   * @param t The time value to seek to (will be wrapped into [0, period))
   */
  seek(t: number, options?: SeekOptions): void;
  // FIXME: JSDoc repetition of proxied functions (maybe use `extend`?)
  /**
   * Seeks to `t` and rebuilds the trail as if the animation naturally arrived there from `t=0`
   * @param t The time value to seek to (will be wrapped into [0, period))
   */
  seekWithTrail(t: number, options?: SeekWithTrailOptions): void;
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
  /** @default 20 */
  glowSize?: number;
}

export interface SarmalOptions extends Omit<RendererOptions, "canvas" | "engine"> {
  /** @default 120 */
  trailLength?: number;
}
