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
let showSkeleton = true;
let currentCode = DEFAULT_CODE;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const codeInput = document.getElementById("code-input") as HTMLTextAreaElement;
const errorDisplay = document.getElementById("error-display") as HTMLElement;
const previewCanvas = document.getElementById("preview-canvas") as HTMLCanvasElement;
const presetSelect = document.getElementById("preset-select") as HTMLSelectElement;
const clearBtn = document.getElementById("clear-btn") as HTMLButtonElement;
const shareBtn = document.getElementById("share-btn") as HTMLButtonElement;
const shareStatus = document.getElementById("share-status") as HTMLElement;
const skeletonToggle = document.getElementById("skeleton-toggle") as HTMLButtonElement;
const speedSlider = document.getElementById("speed-slider") as HTMLInputElement;
const speedValue = document.getElementById("speed-value") as HTMLElement;
const trailSlider = document.getElementById("trail-slider") as HTMLInputElement;
const trailValue = document.getElementById("trail-value") as HTMLElement;
const colorInput = document.getElementById("color-input") as HTMLInputElement;
const headColorInput = document.getElementById("head-color-input") as HTMLInputElement;
const headColorAutoCheckbox = document.getElementById("head-color-auto") as HTMLInputElement;
const trailStyleSelect = document.getElementById("trail-style-select") as HTMLSelectElement;
const paletteSelect = document.getElementById("palette-select") as HTMLSelectElement;
const paletteContainer = document.getElementById("palette-container") as HTMLDivElement;

// Full state shared via the KV API.
interface SharedState {
  v: 1;
  code: string;
  trailStyle: string;
  palette: string;
  trailColor: string;
  headColor: string;
  headColorAuto: boolean;
  trailLength: number;
  speed: number;
  showSkeleton: boolean;
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

// TODO: expose `params` as user-configurable key-value sliders in the UI
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
    headColor: headColorAutoCheckbox.checked ? undefined : headColorInput.value,
    headColorAuto: headColorAutoCheckbox.checked,
    trailLength: parseInt(trailSlider.value, 10),
    speed: parseFloat(speedSlider.value),
    trailStyle: trailStyleSelect.value as "default" | "gradient-static" | "gradient-animated",
    palette: paletteSelect.value as "bard" | "sunset" | "ocean" | "ice" | "fire" | "forest",
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

  const engine = createEngine(
    { name: "playground", fn, period: Math.PI * 2, speed: params.speed },
    params.trailLength,
  );

  const rendererOptions: Parameters<typeof createRenderer>[0] = {
    canvas: previewCanvas,
    engine,
    trailColor: params.trailColor,
    skeletonColor: params.skeletonColor,
    trailStyle: params.trailStyle,
    palette: params.palette,
  };

  // Only pass headColor if not in auto mode
  if (params.headColor) {
    rendererOptions.headColor = params.headColor;
  }

  currentInstance = createRenderer(rendererOptions);
  currentInstance.start();
}

// Update speed without recreating anything
function updateSpeed(speed: number): void {
  currentInstance?.setSpeed(speed);
}

function handleCodeChange(): void {
  clearError();
  currentCode = codeInput.value;

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

function setShareStatus(text: string): void {
  shareStatus.textContent = text;
  shareStatus.classList.toggle("hidden", text === "");
}

async function handleShare(): Promise<void> {
  if (!currentCode) return;

  const params = getParams();
  const state: SharedState = {
    v: 1,
    code: currentCode,
    trailStyle: params.trailStyle,
    palette: params.palette,
    trailColor: params.trailColor,
    headColor: params.headColor ?? headColorInput.value,
    headColorAuto: params.headColorAuto,
    trailLength: params.trailLength,
    speed: params.speed,
    showSkeleton,
  };

  shareBtn.disabled = true;
  setShareStatus("");

  try {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!res.ok) throw new Error(`${res.status}`);

    const { id } = (await res.json()) as { id: string };
    const url = `${window.location.origin}/play?s=${id}`;

    await navigator.clipboard.writeText(url);

    setShareStatus("Link copied. Expires in 90 days.");
    setTimeout(() => {
      shareBtn.disabled = false;
      setShareStatus("");
    }, 3000);
  } catch {
    shareBtn.disabled = false;
    setShareStatus("Couldn't create link. Try again.");
    setTimeout(() => setShareStatus(""), 4000);
  }
}

function updatePaletteVisibility(): void {
  const isGradient = trailStyleSelect.value !== "default";
  if (isGradient) {
    paletteContainer.classList.remove("hidden");
  } else {
    paletteContainer.classList.add("hidden");
  }
}

function updateHeadColorInputState(): void {
  headColorInput.disabled = headColorAutoCheckbox.checked;
  if (headColorAutoCheckbox.checked) {
    headColorInput.classList.add("opacity-50");
  } else {
    headColorInput.classList.remove("opacity-50");
  }
}

function restoreState(state: SharedState): void {
  codeInput.value = state.code;
  currentCode = state.code;

  if (state.trailStyle) trailStyleSelect.value = state.trailStyle;
  if (state.palette) paletteSelect.value = state.palette;
  if (state.trailColor) colorInput.value = state.trailColor;
  if (state.headColor) headColorInput.value = state.headColor;
  if (typeof state.headColorAuto === "boolean") {
    headColorAutoCheckbox.checked = state.headColorAuto;
  }
  if (typeof state.trailLength === "number") {
    trailSlider.value = String(state.trailLength);
    trailValue.textContent = String(state.trailLength);
  }
  if (typeof state.speed === "number") {
    speedSlider.value = String(state.speed);
    speedValue.textContent = state.speed.toFixed(1);
  }
  if (typeof state.showSkeleton === "boolean" && state.showSkeleton !== showSkeleton) {
    handleSkeletonToggle();
  }

  updatePaletteVisibility();
  updateHeadColorInputState();

  clearError();
  const fn = buildCurveFn(state.code);
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
shareBtn.addEventListener("click", () => void handleShare());
codeInput.addEventListener("input", handleCodeChange);
skeletonToggle.addEventListener("click", handleSkeletonToggle);

speedSlider.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  const speed = parseFloat(target.value);
  speedValue.textContent = speed.toFixed(1);
  updateSpeed(speed);
});

trailSlider.addEventListener("input", (e) => {
  const target = e.target as HTMLInputElement;
  trailValue.textContent = target.value;
  updateInstance();
});

colorInput.addEventListener("input", updateInstance);
headColorInput.addEventListener("input", updateInstance);
headColorAutoCheckbox.addEventListener("change", () => {
  updateHeadColorInputState();
  updateInstance();
});
trailStyleSelect.addEventListener("change", () => {
  updatePaletteVisibility();
  updateInstance();
});
paletteSelect.addEventListener("change", updateInstance);

async function init(): Promise<void> {
  const searchParams = new URLSearchParams(window.location.search);
  const shareId = searchParams.get("s");

  // Initialize UI state
  updatePaletteVisibility();
  updateHeadColorInputState();

  if (shareId) {
    try {
      const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
      if (res.ok) {
        const { state } = (await res.json()) as { state: SharedState };
        restoreState(state);
        return;
      }
    } catch {
      // fall through to default
    }
  }

  const fn = buildCurveFn(DEFAULT_CODE);
  if (fn) {
    createInstance(fn, getParams());
  }
}

void init();
