import type {
  CurveDef,
  Engine,
  MorpStrategy,
  Point,
  SeekOptions,
  SeekWithTrailOptions,
} from "./types";

const TWO_PI = Math.PI * 2;
const POINTS_PER_PERIOD_UNIT = 50;

/** Linearly interpolate from start to end by factor t (0→1) */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** Reused across all curve fn calls — params is never populated, allocation is wasteful */
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
 * it runs a clock (time `t`), asks the curve for the current Point position at that time,
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

export function createEngine(curveDef: CurveDef, trailLength: number = 120): Engine {
  if (!Number.isFinite(trailLength) || trailLength <= 0) {
    throw new RangeError(
      `[sarmal] trailLength must be a positive finite number, got ${trailLength}`,
    );
  }

  let curve = resolveCurve(curveDef);
  const trail = new CircularBuffer(trailLength);
  let t = 0;
  let actualTime = 0;

  // Morph state which is `null` when not morphing
  let morphCurveB: ResolvedCurve | null = null;
  let _morphAlpha: number | null = null;
  let _morphStrategy: MorpStrategy = "normalized";

  /** Samples a resolved curve's skeleton at position `sampleT` */
  function sampleSkeleton(c: ResolvedCurve, sampleT: number): Point {
    if (c.skeletonFn) {
      return c.skeletonFn(sampleT);
    }
    if (c.skeleton === "live") {
      return c.fn(sampleT, actualTime, EMPTY_PARAMS);
    }
    return c.fn(sampleT, 0, EMPTY_PARAMS);
  }

  return {
    tick(deltaTime: number): Array<Point> {
      let effectiveSpeed = curve.speed;
      if (morphCurveB !== null && _morphAlpha !== null) {
        effectiveSpeed = lerp(curve.speed, morphCurveB.speed, _morphAlpha);
      }
      t = (t + effectiveSpeed * deltaTime) % curve.period;
      actualTime += deltaTime;

      if (morphCurveB !== null && _morphAlpha !== null) {
        const a = curve.fn(t, actualTime, EMPTY_PARAMS);
        const tB = _morphStrategy === "normalized" ? (t / curve.period) * morphCurveB.period : t;
        const b = morphCurveB.fn(tB, actualTime, EMPTY_PARAMS);
        trail.push(a.x + (b.x - a.x) * _morphAlpha, a.y + (b.y - a.y) * _morphAlpha);
      } else {
        const point = curve.fn(t, actualTime, EMPTY_PARAMS);
        trail.push(point.x, point.y);
      }

      return trail.toArray();
    },

    get trailCount() {
      return trail.length;
    },

    get isLiveSkeleton() {
      return curve.skeleton === "live";
    },

    get morphAlpha() {
      return _morphAlpha;
    },

    reset() {
      t = 0;
      actualTime = 0;
      trail.clear();
    },

    seek(newT: number, { clearTrail = false }: SeekOptions = {}) {
      t = ((newT % curve.period) + curve.period) % curve.period;
      if (clearTrail) {
        trail.clear();
      }
    },

    seekWithTrail(
      targetT: number,
      { wrap = false, step = curve.period / trailLength }: SeekWithTrailOptions = {},
    ) {
      const advance = curve.speed * step;
      const target = ((targetT % curve.period) + curve.period) % curve.period;
      const targetTime = target / curve.speed;

      t = target;
      actualTime = targetTime;
      trail.clear();

      const pointsFromStart = Math.floor(target / advance) + 1;
      const count = wrap ? trailLength : Math.min(trailLength, pointsFromStart);

      for (let i = count - 1; i >= 0; i--) {
        const sampleT = target - i * advance;
        const wrappedT = ((sampleT % curve.period) + curve.period) % curve.period;
        const time = targetTime - i * step;
        const point = curve.fn(wrappedT, time, EMPTY_PARAMS);

        trail.push(point.x, point.y);
      }
    },

    startMorph(target: CurveDef, strategy: MorpStrategy = "normalized") {
      const resolvedTarget = resolveCurve(target);

      if (morphCurveB !== null && _morphAlpha !== null) {
        const frozenAlpha = _morphAlpha;
        const frozenA = curve;
        const frozenB = morphCurveB;
        const frozenStrategy = _morphStrategy;

        curve = {
          ...frozenB,
          fn: (sampleT: number, time: number, params: Record<string, number>) => {
            const a = frozenA.fn(sampleT, time, params);
            const tB =
              frozenStrategy === "normalized"
                ? (sampleT / frozenA.period) * frozenB.period
                : sampleT;
            const b = frozenB.fn(tB, time, params);
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
    },

    setMorphAlpha(alpha: number) {
      _morphAlpha = alpha;
    },

    completeMorph() {
      if (morphCurveB !== null) {
        // Normalized strategy drives `curveB` at `tB` = `(t / periodA) * periodB`
        // Remap `t` so the trail continues from the same position on `curveB`,
        //  not from a raw `t` value that belongs to `curveA`'s smaller range.
        if (_morphStrategy === "normalized" && curve.period !== morphCurveB.period) {
          t = (t / curve.period) * morphCurveB.period;
        }
        curve = morphCurveB;
      }
      morphCurveB = null;
      _morphAlpha = null;
    },

    getSarmalSkeleton(): Array<Point> {
      const steps = Math.ceil(curve.period * POINTS_PER_PERIOD_UNIT);
      // oxlint-disable-next-line unicorn/no-new-array -- array is pre-allocated, filled immediately below
      const points: Array<Point> = new Array(steps);

      if (morphCurveB !== null && _morphAlpha !== null) {
        for (let i = 0; i < steps; i++) {
          const sampleT = (i / (steps - 1)) * curve.period;
          const a = sampleSkeleton(curve, sampleT);
          const tB =
            _morphStrategy === "normalized"
              ? (sampleT / curve.period) * morphCurveB.period
              : sampleT;
          const b = sampleSkeleton(morphCurveB, tB);

          points[i] = {
            x: a.x + (b.x - a.x) * _morphAlpha,
            y: a.y + (b.y - a.y) * _morphAlpha,
          };
        }
        return points;
      }

      for (let i = 0; i < steps; i++) {
        const sampleT = (i / (steps - 1)) * curve.period;
        points[i] = sampleSkeleton(curve, sampleT);
      }

      return points;
    },
  };
}
