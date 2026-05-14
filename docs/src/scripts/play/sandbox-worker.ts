/**
 * Sandbox Worker for the Sarmal playground.
 *
 * Runs in a Web Worker thread with no DOM access — user-supplied code
 * compiled via `new Function()` cannot touch the window, document, cookies,
 * localStorage, or redirect the page. Only postMessage communication is
 * available.
 *
 * Protocol (messages received from main thread):
 *   { type: 'compile', code: string }
 *     Compiles user JS into a function. Sends back compile-result.
 *
 *   { type: 'eval', id: number, phase: number, elapsed: number }
 *     Evaluates the compiled function at (phase, elapsed) and sends back the
 *     result tagged with the same id so the main thread can match responses.
 *
 *   { type: 'evalBatch', id: number, requests: Array<{ phase: number, elapsed: number }> }
 *     Evaluates the function at many (phase, elapsed) points in one batch.
 *     Single round-trip for skeleton sampling, seek reconstruction, etc.
 *
 *   { type: 'detect-variance' }
 *     Samples fn at t=0 and t=1 to determine if the function depends on
 *     the elapsed parameter (time-variant). Sends back detect-result.
 */

import type { Point } from "@sarmal/core";

/** Empty params object reused across all calls — allocation avoidance. */
const EMPTY_PARAMS: Record<string, number> = {};

const DEDUP_SAMPLE_N = 16;
const DEDUP_PERIOD = Math.PI * 2;

type EvalRequest = { phase: number; elapsed: number };

type CompileMessage = { type: "compile"; id: number; code: string };
type EvalMessage = { type: "eval"; id: number; phase: number; elapsed: number };
type EvalBatchMessage = {
  type: "evalBatch";
  id: number;
  requests: Array<EvalRequest>;
};
type DetectMessage = { type: "detect-variance"; id: number };

type IncomingMessage = CompileMessage | EvalMessage | EvalBatchMessage | DetectMessage;

let compiledFn: ((phase: number, elapsed: number, params: Record<string, number>) => Point) | null =
  null;

self.onmessage = (e: MessageEvent<IncomingMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case "compile": {
      const result = compile(msg.code);
      if (result.ok) {
        compiledFn = result.fn;
        const dedupSamples: Point[] = [];
        for (let i = 0; i < DEDUP_SAMPLE_N; i++) {
          dedupSamples.push(result.fn((i / DEDUP_SAMPLE_N) * DEDUP_PERIOD, 0, EMPTY_PARAMS));
        }

        self.postMessage({ type: "compile-result", id: msg.id, ok: true, dedupSamples });
      } else {
        compiledFn = null;
        self.postMessage({ type: "compile-result", id: msg.id, ok: false, error: result.error });
      }

      break;
    }

    case "eval": {
      if (!compiledFn) {
        self.postMessage({
          type: "eval-result",
          id: msg.id,
          ok: false,
          error: "No compiled function",
        });
        return;
      }

      try {
        const pt = compiledFn(msg.phase, msg.elapsed, EMPTY_PARAMS);
        self.postMessage({ type: "eval-result", id: msg.id, ok: true, x: pt.x, y: pt.y });
      } catch (err: unknown) {
        self.postMessage({
          type: "eval-result",
          id: msg.id,
          ok: false,
          error: (err as Error).message,
        });
      }
      break;
    }

    case "evalBatch": {
      if (!compiledFn) {
        self.postMessage({
          type: "evalBatch-result",
          id: msg.id,
          ok: false,
          error: "No compiled function",
        });
        return;
      }

      try {
        const results: Array<Point> = [];
        for (let i = 0; i < msg.requests.length; i++) {
          const req = msg.requests[i];
          results.push(compiledFn(req.phase, req.elapsed, EMPTY_PARAMS));
        }
        self.postMessage({ type: "evalBatch-result", id: msg.id, ok: true, results });
      } catch (err: unknown) {
        self.postMessage({
          type: "evalBatch-result",
          id: msg.id,
          ok: false,
          error: (err as Error).message,
        });
      }
      break;
    }

    case "detect-variance": {
      if (!compiledFn) {
        self.postMessage({ type: "detect-result", id: msg.id, isTimeVariant: false });
        return;
      }

      try {
        const a = compiledFn(0, 0, EMPTY_PARAMS);
        const b = compiledFn(0, 1, EMPTY_PARAMS);
        const isTimeVariant = a.x !== b.x || a.y !== b.y;
        self.postMessage({ type: "detect-result", id: msg.id, isTimeVariant });
      } catch {
        self.postMessage({ type: "detect-result", id: msg.id, isTimeVariant: false });
      }
      break;
    }
  }
};

type CompileReturn =
  | { ok: true; fn: (phase: number, elapsed: number, params: Record<string, number>) => Point }
  | { ok: false; error: string };
function compile(code: string): CompileReturn {
  try {
    const fn = new Function("phase", "elapsed", "params", code) as (
      phase: number,
      elapsed: number,
      params: Record<string, number>,
    ) => Point;
    const result = fn(0, 0, EMPTY_PARAMS);

    if (typeof result !== "object" || result === null || !("x" in result) || !("y" in result)) {
      return { ok: false, error: "fn must return { x, y }" };
    }

    if (typeof result.x !== "number" || typeof result.y !== "number") {
      return { ok: false, error: "fn must return numeric x and y" };
    }

    return { ok: true, fn };
  } catch (err: unknown) {
    return { ok: false, error: (err as Error).message };
  }
}
