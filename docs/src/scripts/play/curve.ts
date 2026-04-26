import type { Point } from "@sarmal/core";
import type { CurveFn } from "./state";

import { codeInput, errorDisplay } from "./dom";

const SAMPLE_N = 16;
const SAMPLE_EPSILON = 1e-9;
const SAMPLE_PERIOD = Math.PI * 2;

export function sampleCurveFn(fn: CurveFn) {
  const samples: Point[] = [];

  for (let i = 0; i < SAMPLE_N; i++) {
    const t = (i / SAMPLE_N) * SAMPLE_PERIOD;
    samples.push(fn(t, 0, {}));
  }

  return samples;
}

export function isEachSamplesEqual(a: Point[], b: Point[]) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > SAMPLE_EPSILON || Math.abs(a[i].y - b[i].y) > SAMPLE_EPSILON) {
      return false;
    }
  }

  return true;
}

export function showError(msg: string) {
  errorDisplay.textContent = msg;
  errorDisplay.classList.remove("hidden");
  codeInput.classList.add("border-error");
  codeInput.classList.remove("border-border");
}

export function clearError() {
  errorDisplay.classList.add("hidden");
  codeInput.classList.remove("border-error");
  codeInput.classList.add("border-border");
}

export function buildCurveFn(code: string) {
  try {
    const fn = new Function("t", "time", "params", code);
    const result = fn(0, 0, {});

    if (typeof result !== "object" || result === null || !("x" in result) || !("y" in result)) {
      throw new Error("fn must return { x, y }");
    }
    return fn as CurveFn;
  } catch (err: unknown) {
    showError((err as Error).message);
    return null;
  }
}

// TODO: Arrow function regex may capture trailing ')' from object returns. Current catalog uses function declarations, so not a practical issue.
export function extractBody(fnStr: string) {
  const fnMatch = fnStr.match(/function\s*\w*\s*\([^)]*\)\s*\{([\s\S]*)\}$/);
  if (fnMatch) {
    return fnMatch[1].trim();
  }
  const arrowMatch = fnStr.match(/=>\s*\{?([\s\S]*)\}?\s*$/);

  if (arrowMatch) {
    return arrowMatch[1].trim();
  }
  return fnStr;
}
