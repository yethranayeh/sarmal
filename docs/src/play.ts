import { createEngine, palettes, createRenderer } from "@sarmal/core";
import type { TrailStyle } from "@sarmal/core";

const DEFAULT_CODE = `return {
  x: Math.cos(t),
  y: Math.sin(t)
}`;

const presetsDataEl = document.getElementById("presets-data");
if (!presetsDataEl) {
  throw new Error("presets-data element not found");
}

const presetsData: Array<{ id: string; fn: string; period?: number }> = JSON.parse(
  presetsDataEl.textContent || "[]",
);
const PRESETS: Record<string, { fn: string; period: number }> = presetsData.reduce(
  (acc, c) => {
    acc[c.id] = { fn: c.fn, period: c.period ?? Math.PI * 2 };
    return acc;
  },
  {} as Record<string, { fn: string; period: number }>,
);

type CurveFn = (
  t: number,
  time: number,
  params: Record<string, number>,
) => { x: number; y: number };

let currentInstance: ReturnType<typeof createRenderer> | null = null;
let showSkeleton = true;
let currentCode = DEFAULT_CODE;
let lastCompiledCode = "";
let lastCompiledFn: CurveFn | null = null;
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
const colorControlsDiv = document.getElementById("color-controls") as HTMLDivElement;
const palettePreview = document.getElementById("palette-preview") as HTMLDivElement;

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

const SAMPLE_N = 16;
const SAMPLE_EPSILON = 1e-9;
const SAMPLE_PERIOD = Math.PI * 2;

function sampleCurveFn(fn: CurveFn): Array<{ x: number; y: number }> {
  const samples: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < SAMPLE_N; i++) {
    const t = (i / SAMPLE_N) * SAMPLE_PERIOD;
    samples.push(fn(t, 0, {}));
  }
  return samples;
}

function samplesEqual(
  a: Array<{ x: number; y: number }>,
  b: Array<{ x: number; y: number }>,
): boolean {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > SAMPLE_EPSILON || Math.abs(a[i].y - b[i].y) > SAMPLE_EPSILON) {
      return false;
    }
  }
  return true;
}

function showError(msg: string) {
  errorDisplay.textContent = msg;
  errorDisplay.classList.remove("hidden");
  codeInput.classList.add("border-error");
  codeInput.classList.remove("border-border");
}

function clearError() {
  errorDisplay.classList.add("hidden");
  codeInput.classList.remove("border-error");
  codeInput.classList.add("border-border");
}

// TODO: expose `params` as user-configurable key-value sliders in the UI
function buildCurveFn(code: string): CurveFn | null {
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

function getResolvedTrailColor() {
  const style = trailStyleSelect.value as TrailStyle;
  if (style !== "default") {
    return palettes[paletteSelect.value as keyof typeof palettes] ?? colorInput.value;
  }
  return colorInput.value;
}

function getResolvedSkeletonColor() {
  if (!showSkeleton) {
    return "transparent";
  }

  const style = trailStyleSelect.value as TrailStyle;

  if (style !== "default") {
    const palette = palettes[paletteSelect.value as keyof typeof palettes];
    return palette ? palette[0] : colorInput.value;
  }
  return colorInput.value;
}

function getParams() {
  return {
    trailColor: colorInput.value,
    skeletonColor: getResolvedSkeletonColor(),
    headColor: headColorAutoCheckbox.checked ? undefined : headColorInput.value,
    headColorAuto: headColorAutoCheckbox.checked,
    trailLength: parseInt(trailSlider.value, 10),
    speed: parseFloat(speedSlider.value),
    trailStyle: trailStyleSelect.value as TrailStyle,
    palette: paletteSelect.value as "bard" | "sunset" | "ocean" | "ice" | "fire" | "forest",
  };
}

function createInstance(fn: CurveFn, params: ReturnType<typeof getParams>, period = Math.PI * 2) {
  if (currentInstance) {
    currentInstance.destroy();
    currentInstance = null;
  }

  const engine = createEngine(
    { name: "playground", fn, period, speed: params.speed },
    params.trailLength,
  );

  const resolvedTrailColor = getResolvedTrailColor();

  const rendererOptions: Parameters<typeof createRenderer>[0] = {
    canvas: previewCanvas,
    engine,
    trailColor: resolvedTrailColor,
    skeletonColor: params.skeletonColor,
    trailStyle: params.trailStyle,
  };

  // Only pass headColor if not in auto mode
  if (params.headColor) {
    rendererOptions.headColor = params.headColor;
  }

  currentInstance = createRenderer(rendererOptions);
  lastCompiledCode = currentCode;
  lastCompiledFn = fn;
}

// Update speed without recreating anything
function updateSpeed(speed: number) {
  currentInstance?.setSpeed(speed);
}

function handleCodeChange() {
  clearError();
  currentCode = codeInput.value;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    // Gate 1: text-identity short-circuit
    if (currentCode === lastCompiledCode) {
      return;
    }

    const fn = buildCurveFn(currentCode);
    if (!fn) {
      return;
    }

    // Gate 2: output sampling
    let oldSamples: Array<{ x: number; y: number }> | undefined;
    try {
      if (lastCompiledFn) {
        oldSamples = sampleCurveFn(lastCompiledFn);
      }
    } catch {
      // Old function throws at some samples and we can't compare so treat as different
    }

    let newSamples: Array<{ x: number; y: number }> | undefined;
    try {
      newSamples = sampleCurveFn(fn);
    } catch {
      showError("Curve function produces invalid output for some values");
      return;
    }

    if (oldSamples && newSamples && samplesEqual(oldSamples, newSamples)) {
      return;
    }

    createInstance(fn, getParams());
  }, 150);
}

// TODO: Arrow function regex may capture trailing ')' from object returns. Current catalog uses function declarations, so not a practical issue.
function extractBody(fnStr: string) {
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

function loadPreset(curveId: string) {
  const preset = PRESETS[curveId];
  if (!preset) {
    return;
  }

  const body = extractBody(preset.fn);
  codeInput.value = body;
  currentCode = body;
  clearError();

  const fn = buildCurveFn(body);
  if (fn) {
    createInstance(fn, getParams(), preset.period);
  }
}

function handleClear() {
  codeInput.value = "";
  currentCode = "";
  history.replaceState(null, "", window.location.pathname);
  clearError();

  if (currentInstance) {
    currentInstance.destroy();
    currentInstance = null;
  }
  lastCompiledCode = "";
  lastCompiledFn = null;
}

function handleSkeletonToggle() {
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

  currentInstance?.setRenderOptions({
    skeletonColor: getResolvedSkeletonColor(),
  });
}

function updateTrailLength() {
  const fn = buildCurveFn(currentCode);
  if (fn) {
    createInstance(fn, getParams());
  }
}

function setShareStatus(text: string) {
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

function updatePalettePreview() {
  const palette = palettes[paletteSelect.value as keyof typeof palettes];
  if (!palette) return;
  const colors = [...palette, palette[0]];
  palettePreview.style.backgroundImage = `linear-gradient(to right, ${colors.join(", ")})`;
  palettePreview.style.backgroundSize = "200% 100%";
  const isAnimated = trailStyleSelect.value === "gradient-animated";
  palettePreview.classList.toggle("animated", isAnimated);
}

function updatePaletteVisibility() {
  const isGradient = trailStyleSelect.value !== "default";
  paletteContainer.classList.toggle("hidden", !isGradient);
  colorControlsDiv.classList.toggle("hidden", isGradient);
  if (isGradient) updatePalettePreview();
}

function updateHeadColorInputState() {
  headColorInput.disabled = headColorAutoCheckbox.checked;
  if (headColorAutoCheckbox.checked) {
    headColorInput.classList.add("opacity-50");
  } else {
    headColorInput.classList.remove("opacity-50");
  }
}

function restoreState(state: SharedState) {
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
});

trailSlider.addEventListener("change", () => {
  updateTrailLength();
});

colorInput.addEventListener("input", () => {
  const style = trailStyleSelect.value as TrailStyle;
  currentInstance?.setRenderOptions({
    ...(style === "default" ? { trailColor: colorInput.value } : {}),
    skeletonColor: getResolvedSkeletonColor(),
  });
});

headColorInput.addEventListener("input", () => {
  if (!headColorAutoCheckbox.checked) {
    currentInstance?.setRenderOptions({ headColor: headColorInput.value });
  }
});

headColorAutoCheckbox.addEventListener("change", () => {
  updateHeadColorInputState();
  currentInstance?.setRenderOptions({
    headColor: headColorAutoCheckbox.checked ? null : headColorInput.value,
  });
});

trailStyleSelect.addEventListener("change", () => {
  updatePaletteVisibility();
  currentInstance?.setRenderOptions({
    trailStyle: trailStyleSelect.value as TrailStyle,
    trailColor: getResolvedTrailColor(),
    skeletonColor: getResolvedSkeletonColor(),
  });
});

paletteSelect.addEventListener("change", () => {
  updatePalettePreview();
  const style = trailStyleSelect.value as TrailStyle;
  if (style !== "default") {
    currentInstance?.setRenderOptions({
      trailColor: getResolvedTrailColor(),
      skeletonColor: getResolvedSkeletonColor(),
    });
  }
});

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
