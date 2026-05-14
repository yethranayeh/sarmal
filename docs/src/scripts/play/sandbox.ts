/**
 * Main-thread sandbox facade for the Sarmal playground.
 *
 * Wraps a Web Worker that compiles and evaluates user-supplied math code
 *  in an isolated thread with no DOM access.
 * ! When the Worker is available, it is the only code execution path
 * ! Failed Worker compilations are surfaced as errors, **never** silently re-executed on the main thread.
 *
 * Strategy:
 * - Static curves (fn depends only on `phase`, not `elapsed`): the Worker
 *   compiles the code once, samples the full period, and stands down.
 *   The main thread creates a regular engine with a lookup-table proxy.
 * - Dynamic curves (fn depends on `elapsed`): the Worker stays live and
 *   evaluates fn on every tick. Round-trip latency is <1ms per frame.
 * - Dedup samples: the Worker returns 16 points per compile. The main thread
 *    compares these against the last successful compile
 *      to skip redundant rebuilds without re-executing user code locally
 *
 * Graceful fallback: if Workers are unsupported, falls back to direct
 *  `new Function()` on the main thread.
 */

import type { Point } from "@sarmal/core";
import type { CurveFn } from "./types";

/**
 * Messages received from the Worker.
 * Each response variant includes the `id` that the main thread sent,
 * so callers can match responses to requests.
 */
type WorkerOutMap = {
  "compile-result": {
    type: "compile-result";
    id: number;
    ok: boolean;
    error?: string;
    dedupSamples?: Point[];
  };
  "eval-result": {
    type: "eval-result";
    id: number;
    ok: boolean;
    x?: number;
    y?: number;
    error?: string;
  };
  "evalBatch-result": {
    type: "evalBatch-result";
    id: number;
    ok: boolean;
    results?: Array<Point>;
    error?: string;
  };
  "detect-result": { type: "detect-result"; id: number; isTimeVariant: boolean };
};

type WorkerOut = WorkerOutMap[keyof WorkerOutMap];

let nextId = 0;

/**
 * Sends a message to the Worker and returns a Promise that resolves with
 * the matching response. Uses a monotonically increasing id to pair
 * requests with responses.
 */
function request(worker: Worker, msg: Record<string, unknown>): Promise<WorkerOut> {
  const id = nextId++;
  return new Promise((resolve) => {
    const handler = (e: MessageEvent<WorkerOut>) => {
      const data = e.data;
      if ("id" in data && data.id === id) {
        worker.removeEventListener("message", handler);
        resolve(data);
      }
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ ...msg, id });
  });
}

/** Result of compiling user code in the sandbox. */
export type CompileResult =
  | { ok: true; isTimeVariant: boolean; dedupSamples: Point[] }
  | { ok: false; error: string };

/**
 * Compiles user code in the Worker, validates the return shape, and
 * detects whether the function depends on the `elapsed` parameter.
 *
 * Returns `{ ok: true, isTimeVariant, dedupSamples }` on success.
 * Identical source code produces identical samples.
 * @returns `{ ok: false, error }` if compilation or validation fails.
 */
export async function compile(worker: Worker, code: string): Promise<CompileResult> {
  const result = await request(worker, { type: "compile", code });
  if (result.type !== "compile-result") {
    return { ok: false, error: "Worker protocol error" };
  }
  const compileResult = result as WorkerOutMap["compile-result"];
  if (!compileResult.ok) {
    return { ok: false, error: compileResult.error ?? "Unknown error" };
  }

  const dedupSamples = compileResult.dedupSamples ?? [];
  const detect = await request(worker, { type: "detect-variance" });
  const detectResult = detect as WorkerOutMap["detect-result"];
  return { ok: true, isTimeVariant: detectResult.isTimeVariant, dedupSamples };
}

/**
 * Evaluates the compiled function at many (phase, elapsed) points in a
 * single batch. Used for skeleton sampling, seek reconstruction, and
 * static-curve pre-sampling.
 *
 * @param requests - Array of { phase, elapsed } evaluation points.
 * @returns Corresponding array of { x, y } results.
 */
export async function evaluateBatch(
  worker: Worker,
  requests: Array<{ phase: number; elapsed: number }>,
): Promise<Array<Point>> {
  const result = await request(worker, { type: "evalBatch", requests });
  const batchResult = result as WorkerOutMap["evalBatch-result"];
  if (result.type !== "evalBatch-result" || !batchResult.ok) {
    throw new Error(batchResult.error ?? "Batch evaluation failed");
  }
  return batchResult.results!;
}

/**
 * Pre-samples a static curve over one full period and returns an array of
 * { x, y } points. These can be used as a lookup table: at any phase,
 * linearly interpolate between the two nearest samples.
 *
 * Each sample is evaluated at `elapsed=0` since the curve is static.
 *
 * @param worker - Compiled Worker.
 * @param period - The curve's period (default 2π).
 * @param numSamples - Number of evenly-spaced samples (default 500).
 */
export async function preSample(
  worker: Worker,
  period = Math.PI * 2,
  numSamples = 500,
): Promise<Array<Point>> {
  const requests: Array<{ phase: number; elapsed: number }> = [];
  for (let i = 0; i < numSamples; i++) {
    requests.push({ phase: (i / numSamples) * period, elapsed: 0 });
  }
  return evaluateBatch(worker, requests);
}

/**
 * Creates a synchronous proxy function from a pre-sampled lookup table.
 * The returned function accepts (phase, _elapsed, _params) and returns
 * { x, y } by linearly interpolating between the two nearest samples.
 *
 * The `elapsed` and `params` parameters are accepted but ignored — the
 * lookup table is only valid for static curves.
 *
 * @param samples - Pre-sampled points covering one full period.
 * @param period - The curve's period (default 2π).
 * @returns A function with the same signature as CurveFn.
 */
export function createLookupFn(samples: Array<Point>, period = Math.PI * 2): CurveFn {
  const n = samples.length;
  return (_phase: number, _elapsed: number, _params: Record<string, number>): Point => {
    const phase = ((_phase % period) + period) % period;
    const raw = (phase / period) * (n - 1);
    const i0 = Math.floor(raw);
    const i1 = i0 + 1;
    const frac = raw - i0;

    if (i1 >= n) {
      // Last sample — wrap to first for periodic continuity
      const a = samples[n - 1];
      const b = samples[0];
      return {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac,
      };
    }

    const a = samples[i0];
    const b = samples[i1];
    return {
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
    };
  };
}

/**
 * Checks whether Web Workers are supported in the current runtime.
 */
export function workersSupported(): boolean {
  return typeof Worker !== "undefined";
}

/**
 * Creates a synchronous eval proxy for dynamic curves.
 *
 * The Worker stays live, evaluating `fn(phase, elapsed, params)` on every tick.
 * The proxy fires a `postMessage` to the Worker each time it's called
 *  and immediately returns the previous frame's cached result.
 * The Worker's response updates the cache for the next frame
 *
 * Calls at `elapsed === 0` (used during renderer construction for skeleton sampling)
 *  bypass the async path entirely and use a pre-sampled lookup table.
 * This avoids zero-size bounding boxes from the initial `{ x: 0, y: 0 }` cached value.
 *
 * Only the most recently sent **eval-id** is accepted.
 * Stale in-flight results are dropped to avoid flickering.
 *
 * @param worker - A Worker that has been compiled through `compile()`.
 * @param skeletonSamples - Pre-sampled curve points at `elapsed=0` for
 *                            the renderer's initial skeleton computation.
 * @param period - The curve's period in seconds.
 */
export function createEvalLoop(
  worker: Worker,
  skeletonSamples: Point[],
  period: number,
): {
  proxyFn: CurveFn;
  dispose: () => void;
} {
  const skeletonFn = createLookupFn(skeletonSamples, period);
  let cachedPoint: Point = skeletonSamples[0];
  let lastSentId = 0;

  function handler(e: MessageEvent<WorkerOut>) {
    const data = e.data;
    if (data.type !== "eval-result") {
      return;
    }

    if (data.id !== lastSentId) {
      return;
    }

    if (data.ok) {
      cachedPoint = { x: data.x!, y: data.y! };
    }
  }

  worker.addEventListener("message", handler);

  const proxyFn: CurveFn = (
    phase: number,
    elapsed: number,
    _params: Record<string, number>,
  ): Point => {
    if (elapsed === 0) {
      return skeletonFn(phase, elapsed, _params);
    }

    const id = ++lastSentId;
    worker.postMessage({ type: "eval", id, phase, elapsed });
    return cachedPoint;
  };

  return {
    proxyFn,
    dispose() {
      worker.removeEventListener("message", handler);
    },
  };
}

/**
 * Creates a new Worker instance for the sandbox. Handles Vite's
 * bundling of Worker modules.
 *
 * Returns null if Workers are not supported.
 */
export function createSandboxWorker(): Worker | null {
  if (!workersSupported()) {
    return null;
  }

  return new Worker(new URL("./sandbox-worker.ts", import.meta.url), { type: "module" });
}
