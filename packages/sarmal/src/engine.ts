import type { CurveDef, Engine, Point } from "./types";

const TWO_PI = Math.PI * 2;
const POINTS_PER_PERIOD_UNIT = 50;

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
export function createEngine(curveDef: CurveDef, trailLength: number = 120): Engine {
  const curve = {
    name: curveDef.name,
    fn: curveDef.fn,
    period: curveDef.period ?? TWO_PI,
    speed: curveDef.speed ?? 1,
  };
  const trail = new CircularBuffer(trailLength);
  let t = 0;
  let actualTime = 0;

  return {
    tick(deltaTime: number): Array<Point> {
      t = (t + curve.speed * deltaTime) % curve.period;
      actualTime += deltaTime;
      const point = curve.fn(t, actualTime, {});
      trail.push(point.x, point.y);
      return trail.toArray();
    },

    get trailCount() {
      return trail.length;
    },

    reset() {
      t = 0;
      actualTime = 0;
      trail.clear();
    },

    getSarmalSkeleton(): Array<Point> {
      const steps = Math.ceil(curve.period * POINTS_PER_PERIOD_UNIT);
      // oxlint-disable-next-line unicorn/no-new-array -- array is pre-allocated, filled immediately below
      const points: Array<Point> = new Array(steps);
      for (let i = 0; i < steps; i++) {
        const sampleT = (i / (steps - 1)) * curve.period;
        const point = curve.fn(sampleT, 0, {});
        points[i] = point;
      }
      return points;
    },
  };
}
