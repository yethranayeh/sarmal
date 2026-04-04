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
}

export interface Engine {
  /**
   * Advances the Sarmal simulation by the given delta time (dt) in seconds.
   * Internally, this increases the simulation time `t` by `speed * dt`,
   *  wraps `t` at `period`, evaluates the curve's parametric function `fn(t)`,
   *  and appends the new point to the trail.
   * Returns a `Point` array, which are sorted oldest to newest
   * @param deltaTime Delta time in seconds (typically frame time from **requestAnimationFrame** or similar)
   */
  tick(deltaTime: number): Array<Point>;
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
   * The skeleton is always derived from the curve's state at `t=0` using `fn(t, 0)`
   * This represents the full path the sarmal would trace on its first complete cycle,
   *  rendered as a static background reference.
   *
   * The number of sample points is automatically derived from the curve's period.
   */
  getSarmalSkeleton(): Array<Point>;
}

export interface SarmalInstance {
  start(): void;
  stop(): void;
  /** Resets the engine and clears the trail */
  reset(): void;
  /** Stops the animation and cleans up resources */
  destroy(): void;
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
