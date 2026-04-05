import { createEngine } from "@sarmal/core";
import { createRenderer } from "@sarmal/core";

const DEFAULT_CODE = `return {
  x: Math.cos(t),
  y: Math.sin(t)
}`;

const presetsDataEl = document.getElementById("presets-data");
if (!presetsDataEl) {
  throw new Error("presets-data element not found");
}

const presetsData: Array<{ id: string; fn: string }> = JSON.parse(
  presetsDataEl.textContent || "[]",
);
const PRESETS: Record<string, string> = presetsData.reduce(
  (acc, c) => {
    acc[c.id] = c.fn;
    return acc;
  },
  {} as Record<string, string>,
);

let currentInstance: ReturnType<typeof createRenderer> | null = null;
let currentEngine: ReturnType<typeof createEngine> | null = null;
let showSkeleton = true;
let currentCode = DEFAULT_CODE;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const codeInput = document.getElementById("code-input") as HTMLTextAreaElement;
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const previewCanvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
const presetSelect = document.getElementById("preset-select") as HTMLSelectElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const skeletonToggle = document.getElementById("skeleton-toggle") as HTMLButtonElement;
const speedSlider = document.getElementById("speed-slider") as HTMLInputElement;
const speedValue = document.getElementById("speed-value") as HTMLElement;
const trailSlider = document.getElementById("trail-slider") as HTMLInputElement;
const trailValue = document.getElementById("trail-value") as HTMLElement;
const glowSlider = document.getElementById("glow-slider") as HTMLInputElement;
const glowValue = document.getElementById("glow-value") as HTMLElement;
const colorInput = document.getElementById("color-input") as HTMLInputElement;
const headColorInput = document.getElementById("head-color-input") as HTMLInputElement;

function encodeHash(code: string): string {
  return btoa(encodeURIComponent(code));
}

function decodeHash(hash: string): string | null {
  try {
    return decodeURIComponent(atob(hash));
  } catch {
    return null;
  }
}

function updateHash(code: string): void {
  history.replaceState(null, "", "#" + encodeHash(code));
}

function showError(msg: string): void {
  errorDisplay.textContent = msg;
  errorDisplay.classList.remove("hidden");
  codeInput.classList.add("border-error");
  codeInput.classList.remove("border-border");
}

function clearError(): void {
  errorDisplay.classList.add("hidden");
  codeInput.classList.remove("border-error");
  codeInput.classList.add("border-border");
}

/**
 * FIXME
 * ! `params` is reserved for future, but not yet exposed on UI
 */
function buildCurveFn(code: string) {
  try {
    const fn = new Function("t", "time", "params", code);
    const result = fn(0, 0, {});

    if (typeof result !== "object" || result === null || !("x" in result) || !("y" in result)) {
      throw new Error("fn must return { x, y }");
    }
    return fn as (
      t: number,
      time: number,
      params: Record<string, number>,
    ) => { x: number; y: number };
  } catch (err: unknown) {
    showError((err as Error).message);
    return null;
  }
}

function getParams() {
  return {
    trailColor: colorInput.value,
    skeletonColor: showSkeleton ? colorInput.value : "transparent",
    headColor: headColorInput.value,
    glowSize: parseInt(glowSlider.value, 10),
    trailLength: parseInt(trailSlider.value, 10),
    speed: parseFloat(speedSlider.value),
  };
}

function createInstance(
  fn: (t: number, time: number, params: Record<string, number>) => { x: number; y: number },
  params: ReturnType<typeof getParams>,
) {
  if (currentInstance) {
    currentInstance.destroy();
    currentInstance = null;
  }

  if (currentEngine) {
    currentEngine = null;
  }

  currentEngine = createEngine(
    { name: "playground", fn, period: Math.PI * 2, speed: params.speed },
    params.trailLength,
  );

  currentInstance = createRenderer({
    canvas: previewCanvas,
    engine: currentEngine,
    trailColor: params.trailColor,
    skeletonColor: params.skeletonColor,
    headColor: params.headColor,
    glowSize: params.glowSize,
  });
  currentInstance.start();
}

function handleCodeChange(): void {
  clearError();
  currentCode = codeInput.value;
  updateHash(currentCode);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const fn = buildCurveFn(currentCode);
    if (fn) {
      createInstance(fn, getParams());
    }
  }, 150);
}

// TODO: Arrow function regex may capture trailing ')' from object returns. Current catalog uses function declarations, so not a practical issue.
function extractBody(fnStr: string): string {
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

function loadPreset(curveId: string): void {
  const fnStr = PRESETS[curveId];
  if (!fnStr) {
    return;
  }

  const body = extractBody(fnStr);
  codeInput.value = body;
  currentCode = body;
  updateHash(body);
  clearError();

  const fn = buildCurveFn(body);
  if (fn) {
    createInstance(fn, getParams());
  }
}

function handleClear(): void {
  codeInput.value = "";
  currentCode = "";
  history.replaceState(null, "", window.location.pathname);
  clearError();

  if (currentInstance) {
    currentInstance.destroy();
    currentInstance = null;
    currentEngine = null;
  }
}

function handleSkeletonToggle(): void {
  showSkeleton = !showSkeleton;
  const knob = skeletonToggle.querySelector("span");

  if (showSkeleton) {
    skeletonToggle.classList.remove("bg-border");
    skeletonToggle.classList.add("bg-foreground");
    knob?.classList.remove("translate-x-0");
    knob?.classList.add("translate-x-5");
  } else {
    skeletonToggle.classList.add("bg-border");
    skeletonToggle.classList.remove("bg-foreground");
    knob?.classList.remove("translate-x-5");
    knob?.classList.add("translate-x-0");
  }

  const fn = buildCurveFn(currentCode);
  if (fn) {
    createInstance(fn, getParams());
  }
}

function updateInstance(): void {
  const fn = buildCurveFn(currentCode);
  if (fn) {
    createInstance(fn, getParams());
  }
}

presetSelect.addEventListener("change", (e) => {
  const target = e.target as HTMLSelectElement;

  if (target.value) {
    loadPreset(target.value);
  }
});

clearBtn.addEventListener("click", handleClear);
codeInput.addEventListener("input", handleCodeChange);
skeletonToggle.addEventListener("click", handleSkeletonToggle);

speedSlider.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  speedValue.textContent = parseFloat(target.value).toFixed(1);
  updateInstance();
});

trailSlider.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  trailValue.textContent = target.value;
  updateInstance();
});

glowSlider.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  glowValue.textContent = target.value;
  updateInstance();
});

colorInput.addEventListener("input", updateInstance);

headColorInput.addEventListener("input", updateInstance);

function init(): void {
  const hash = window.location.hash.slice(1);

  if (hash) {
    const decoded = decodeHash(hash);

    if (decoded) {
      codeInput.value = decoded;
      currentCode = decoded;

      const fn = buildCurveFn(decoded);
      if (fn) {
        createInstance(fn, getParams());
        return;
      }
    }
  }

  const fn = buildCurveFn(DEFAULT_CODE);
  if (fn) {
    createInstance(fn, getParams());
  }
}

init();
