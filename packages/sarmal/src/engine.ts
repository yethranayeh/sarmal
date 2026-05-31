import type { CurveDef, Engine, JumpOptions, MorphStrategy, Point, SeekOptions } from "./types";

const TWO_PI = Math.PI * 2;
const POINTS_PER_PERIOD_UNIT = 50;

type SpeedTransition = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
  resolve: () => void;
  reject: (err: Error) => void;
};

/** Linearly interpolate from start to end by factor t (0→1) */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** Reused across all curve fn calls but params is never populated, allocation is wasteful */
const EMPTY_PARAMS: Record<string, number> = {};

/**
 * A fixed-size list of points with first in, last out method
 * The oldest entry is automatically discarded when the list is at capacity
 *
 * Note: `result.length` is *never* changed,
 *  so callers use the separate `count` getter to know valid size
 */
class CircularBuffer {
  private data: Array<Point>;
  private result: Array<Point>;
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.data = Array.from({ length: capacity }, () => ({ x: 0, y: 0 }));
    this.result = Array.from({ length: capacity }, () => ({ x: 0, y: 0 }));
  }

  /** Mutates in-place */
  push(x: number, y: number): void {
    const slot = this.data[this.head]!;

    slot.x = x;
    slot.y = y;
    this.head = (this.head + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Copies ordered points into the pre-allocated result buffer and returns it
   * Note: The *same* array reference is returned every call,
   *  so `result.length` is also always `capacity`
   */
  toArray(): Array<Point> {
    const start = this.count < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.count; i++) {
      const src = this.data[(start + i) % this.capacity]!;
      const dst = this.result[i]!;
      dst.x = src.x;
      dst.y = src.y;
    }

    return this.result;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  get length() {
    return this.count;
  }
}

/**
 * Creates the core simulation engine for a sarmal
 *
 * it runs a clock (`phase`), asks the curve for the current Point position at that time,
 *  and remembers the last N positions so the renderer can draw the trail
 *
 * The engine is only responsible for math coordinates,
 *  so it is not responsible for drawing or colors
 *
 * @param curveDef A curve definition
 * @param trailLength default: `120`
 */
/** Normalised resolution of a CurveDef, with required fields filled in */
type ResolvedCurve = {
  name: string;
  fn: CurveDef["fn"];
  period: number;
  speed: number;
  skeleton?: CurveDef["skeleton"];
  skeletonFn?: CurveDef["skeletonFn"];
};

function resolveCurve(curveDef: CurveDef): ResolvedCurve {
  const period = curveDef.period ?? TWO_PI;

  if (!Number.isFinite(period) || period <= 0) {
    throw new RangeError(`[sarmal] period must be a positive finite number, got ${period}`);
  }

  const speed = curveDef.speed ?? 1;

  if (!Number.isFinite(speed)) {
    throw new RangeError(`[sarmal] speed must be a finite number, got ${speed}`);
  }

  return {
    name: curveDef.name,
    fn: curveDef.fn,
    period,
    speed,
    skeleton: curveDef.skeleton,
    skeletonFn: curveDef.skeletonFn,
  };
}

/**
 * Wrap a phase value into the half-open range [0, period).
 *
 * Phases can drift negative (e.g. after applying a morph offset) or exceed one period as time advances.
 * The double-mod handles negatives
 */
function wrapPhase(phase: number, period: number) {
  return ((phase % period) + period) % period;
}

/**
 * Find how far to shift curveB's evaluation phase so the morph begins from the
 * point on curveB that is physically closest to curveA's current head.
 *
 * Without this, curveB starts at its "natural" phase — the phase that maps to the
 * same normalized position along the curve as curveA. That phase is often visually
 * far from where curveA's head actually is, so the head appears to snap across the
 * canvas when the morph begins. Aligning to the nearest point removes that snap.
 *
 * The search samples curveB once over its whole period (≈315 points for a 2π curve)
 * and keeps the sample nearest to curveA's head by squared distance (no `sqrt` —
 * we only compare distances, so the square root would be wasted work). It returns
 * the offset to add to the natural phase, i.e. `closestPhase - naturalPhaseB`.
 *
 * @param curveA - the curve currently being traced (the morph's source)
 * @param targetB - the curve being morphed toward
 * @param phase - curveA's current phase
 * @param actualTime - elapsed time, passed through so animated curves sample correctly
 * @param strategy - how curveB's phase tracks curveA's ("normalized" rescales by period)
 * @returns the phase offset to add to curveB's natural phase during the morph
 */
function computeMorphPhaseOffset(
  curveA: ResolvedCurve,
  targetB: ResolvedCurve,
  phase: number,
  actualTime: number,
  strategy: MorphStrategy,
): number {
  const currentA = curveA.fn(phase, actualTime, EMPTY_PARAMS);
  const naturalPhaseB =
    strategy === "normalized" ? (phase / curveA.period) * targetB.period : phase;

  const steps = Math.ceil(targetB.period * POINTS_PER_PERIOD_UNIT);
  let bestOffset = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps; i++) {
    const samplePhase = (i / steps) * targetB.period;
    const pt = targetB.fn(samplePhase, actualTime, EMPTY_PARAMS);
    const dx = pt.x - currentA.x;
    const dy = pt.y - currentA.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = samplePhase - naturalPhaseB;
    }
  }

  return bestOffset;
}

export function createEngine(curveDef: CurveDef, trailLength: number = 120): Engine {
  if (!Number.isFinite(trailLength) || trailLength <= 0) {
    throw new RangeError(
      `[sarmal] trailLength must be a positive finite number, got ${trailLength}`,
    );
  }

  let curve = resolveCurve(curveDef);
  const trail = new CircularBuffer(trailLength);
  let phase = 0;
  let actualTime = 0;
  let userSpeedOverride: number | null = null;

  // Morph state which is `null` when not morphing
  let morphCurveB: ResolvedCurve | null = null;
  let _morphAlpha: number | null = null;
  let _morphStrategy: MorphStrategy = "normalized";
  // How far curveB's evaluation phase is shifted so the morph starts from the point
  //  on curveB nearest curveA's head (see computeMorphPhaseOffset).
  // 0 when not morphing.
  let morphPhaseOffsetB: number = 0;

  // Speed transition state which is `null` when not transitioning
  let _speedTransition: SpeedTransition | null = null;

  /** Samples a resolved curve's skeleton at position `samplePhase` */
  function sampleSkeleton(c: ResolvedCurve, samplePhase: number): Point {
    if (c.skeletonFn) {
      return c.skeletonFn(samplePhase);
    }

    if (c.skeleton === "live") {
      return c.fn(samplePhase, actualTime, EMPTY_PARAMS);
    }

    return c.fn(samplePhase, 0, EMPTY_PARAMS);
  }

  return {
    tick(deltaTime: number): Array<Point> {
      if (_speedTransition !== null) {
        // tick() receives dt in seconds, but SpeedTransition.duration is in milliseconds.
        // Convert dt to ms so the elapsed/duration ratio is dimensionless.
        _speedTransition.elapsed += deltaTime * 1000;
        const alpha = Math.min(_speedTransition.elapsed / _speedTransition.duration, 1);
        userSpeedOverride = lerp(_speedTransition.from, _speedTransition.to, alpha);
        if (alpha >= 1) {
          userSpeedOverride = _speedTransition.to;
          _speedTransition.resolve();
          _speedTransition = null;
        }
      }

      let effectiveSpeed = userSpeedOverride ?? curve.speed;
      if (morphCurveB !== null && _morphAlpha !== null) {
        effectiveSpeed = lerp(effectiveSpeed, morphCurveB.speed, _morphAlpha);
      }
      phase = (phase + effectiveSpeed * deltaTime) % curve.period;
      actualTime += deltaTime;

      if (morphCurveB !== null && _morphAlpha !== null) {
        const a = curve.fn(phase, actualTime, EMPTY_PARAMS);
        const naturalPhaseB =
          _morphStrategy === "normalized" ? (phase / curve.period) * morphCurveB.period : phase;
        const phaseB = wrapPhase(naturalPhaseB + morphPhaseOffsetB, morphCurveB.period);
        const b = morphCurveB.fn(phaseB, actualTime, EMPTY_PARAMS);
        trail.push(a.x + (b.x - a.x) * _morphAlpha, a.y + (b.y - a.y) * _morphAlpha);
      } else {
        const point = curve.fn(phase, actualTime, EMPTY_PARAMS);
        trail.push(point.x, point.y);
      }

      return trail.toArray();
    },

    get trailCount() {
      return trail.length;
    },

    get trailLength() {
      return trailLength;
    },

    get isLiveSkeleton() {
      return curve.skeleton === "live";
    },

    get morphAlpha() {
      return _morphAlpha;
    },

    reset() {
      phase = 0;
      actualTime = 0;
      trail.clear();
    },

    jump(newPhase: number, { clearTrail = false }: JumpOptions = {}) {
      phase = ((newPhase % curve.period) + curve.period) % curve.period;

      if (clearTrail) {
        trail.clear();
      }
    },

    seek(
      targetPhase: number,
      { wrap = false, step = curve.period / trailLength }: SeekOptions = {},
    ) {
      const advance = curve.speed * step;
      const target = ((targetPhase % curve.period) + curve.period) % curve.period;
      const targetTime = target / curve.speed;

      phase = target;
      actualTime = targetTime;
      trail.clear();

      const pointsFromStart = Math.floor(target / advance) + 1;
      const count = wrap ? trailLength : Math.min(trailLength, pointsFromStart);

      for (let i = count - 1; i >= 0; i--) {
        const samplePhase = target - i * advance;
        const wrappedPhase = ((samplePhase % curve.period) + curve.period) % curve.period;
        const elapsed = targetTime - i * step;
        const point = curve.fn(wrappedPhase, elapsed, EMPTY_PARAMS);

        trail.push(point.x, point.y);
      }
    },

    startMorph(target: CurveDef, strategy: MorphStrategy = "normalized", align: boolean = false) {
      const resolvedTarget = resolveCurve(target);

      if (morphCurveB !== null && _morphAlpha !== null) {
        const frozenAlpha = _morphAlpha;
        const frozenA = curve;
        const frozenB = morphCurveB;
        const frozenStrategy = _morphStrategy;
        // Capture the in-progress offset so the frozen snapshot evaluates curveB at the
        //  exact phase it was being rendered at
        // ! otherwise the interpolated head we freeze wouldn't match
        //  what was actually on screen when the interrupt happened.
        const frozenPhaseOffsetB = morphPhaseOffsetB;

        curve = {
          ...frozenB,
          fn: (samplePhase: number, elapsed: number, params: Record<string, number>) => {
            const a = frozenA.fn(samplePhase, elapsed, params);
            const naturalPhaseB =
              frozenStrategy === "normalized"
                ? (samplePhase / frozenA.period) * frozenB.period
                : samplePhase;
            const phaseB = wrapPhase(naturalPhaseB + frozenPhaseOffsetB, frozenB.period);
            const b = frozenB.fn(phaseB, elapsed, params);

            return {
              x: a.x + (b.x - a.x) * frozenAlpha,
              y: a.y + (b.y - a.y) * frozenAlpha,
            };
          },
        };
      }

      _morphStrategy = strategy;
      morphCurveB = resolvedTarget;
      _morphAlpha = 0;
      // When alignment is requested, start curveB from the point nearest curveA's current
      //  head to remove the visual snap.
      // After an interrupt, `curve` is the frozen snapshot above, so this measures from the live interpolated position,
      //  not the original source curve.
      // When off, the offset stays 0 and curveB starts from its phase 0.
      morphPhaseOffsetB = align
        ? computeMorphPhaseOffset(curve, resolvedTarget, phase, actualTime, strategy)
        : 0;
    },

    setMorphAlpha(alpha: number) {
      _morphAlpha = alpha;
    },

    completeMorph() {
      if (morphCurveB !== null) {
        // Normalized strategy drives `curveB` at `phaseB` = `(phase / periodA) * periodB`
        // Remap `phase` so the trail continues from the same position on `curveB`,
        //  not from a raw `phase` value that belongs to `curveA`'s smaller range.
        if (_morphStrategy === "normalized" && curve.period !== morphCurveB.period) {
          phase = (phase / curve.period) * morphCurveB.period;
        }
        // Fold the alignment offset into `phase` so the now-active curveB continues from
        //  exactly where the morph left the head
        // ! Without this the head would jump from the aligned position back to curveB's natural phase on the next tick.
        phase = wrapPhase(phase + morphPhaseOffsetB, morphCurveB.period);
        curve = morphCurveB;
      }
      morphCurveB = null;
      _morphAlpha = null;
      morphPhaseOffsetB = 0;
    },

    getSarmalSkeleton(): Array<Point> {
      const steps = Math.ceil(curve.period * POINTS_PER_PERIOD_UNIT);
      // oxlint-disable-next-line unicorn/no-new-array -- array is pre-allocated, filled immediately below
      const points: Array<Point> = new Array(steps);

      if (morphCurveB !== null && _morphAlpha !== null) {
        for (let i = 0; i < steps; i++) {
          const samplePhase = (i / (steps - 1)) * curve.period;
          const a = sampleSkeleton(curve, samplePhase);
          const phaseB =
            _morphStrategy === "normalized"
              ? (samplePhase / curve.period) * morphCurveB.period
              : samplePhase;
          const b = sampleSkeleton(morphCurveB, phaseB);

          points[i] = {
            x: a.x + (b.x - a.x) * _morphAlpha,
            y: a.y + (b.y - a.y) * _morphAlpha,
          };
        }
        return points;
      }

      for (let i = 0; i < steps; i++) {
        const samplePhase = (i / (steps - 1)) * curve.period;
        points[i] = sampleSkeleton(curve, samplePhase);
      }

      return points;
    },

    setSpeed(speed: number): void {
      if (!Number.isFinite(speed)) {
        throw new Error("speed must be a finite number");
      }
      if (_speedTransition !== null) {
        _speedTransition.reject(new Error("Speed transition cancelled"));
        _speedTransition = null;
      }
      userSpeedOverride = speed;
    },

    getSpeed(): number {
      return userSpeedOverride ?? curve.speed;
    },

    resetSpeed(): void {
      userSpeedOverride = null;
    },

    setSpeedOver(speed: number, duration: number): Promise<void> {
      if (!Number.isFinite(speed)) {
        throw new Error("speed must be a finite number");
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("duration must be a finite number greater than 0");
      }

      if (_speedTransition !== null) {
        _speedTransition.reject(new Error("Speed transition cancelled"));
        _speedTransition = null;
      }

      const from = userSpeedOverride ?? curve.speed;

      return new Promise<void>((resolve, reject) => {
        _speedTransition = { from, to: speed, elapsed: 0, duration, resolve, reject };
      });
    },

    cancelSpeedTransition(): void {
      if (_speedTransition !== null) {
        _speedTransition.reject(new Error("Speed transition cancelled"));
        _speedTransition = null;
      }
    },
  };
}
