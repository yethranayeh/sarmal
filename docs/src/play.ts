import { createEngine } from "@sarmal/core";
import { createRenderer } from "@sarmal/core";
import { createSarmal, curves } from "@sarmal/core";

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
    headColor: headColorInput.value,
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

interface MorphPair {
  from: string;
  to: string;
  label: string;
}

const MORPH_PAIRS: MorphPair[] = [
  { from: "astroid", to: "deltoid", label: "Static -> Static" },
  { from: "astroid", to: "lissajous32", label: "Static -> Live" },
  { from: "lissajous32", to: "lame", label: "Live -> Live" },
  {
    from: "circle-fast",
    to: "astroid",
    label: "Mismatched Periods",
  },
];

const fastCircleCurve = {
  fn: (t: number, _time: number, _params: Record<string, number>) => ({
    x: Math.cos(2 * t),
    y: Math.sin(2 * t),
  }),
  period: Math.PI,
  name: "Fast Circle",
};

function setupMorphDemo() {
  const grid = document.getElementById("morph-demo-grid");
  if (!grid) return;

  for (const pair of MORPH_PAIRS) {
    const card = document.createElement("div");
    card.className = "flex flex-col items-center gap-2";

    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    canvas.className = "border border-border rounded-md";

    const btn = document.createElement("button");
    btn.className =
      "font-mono text-[10px] tracking-wider uppercase px-2 py-1 rounded border border-border text-muted hover:border-primary hover:text-foreground transition-colors";
    btn.textContent = "Morph";

    const label = document.createElement("span");
    label.className = "font-mono text-[10px] tracking-wider uppercase text-muted text-center";
    label.textContent = pair.label;

    card.appendChild(canvas);
    card.appendChild(btn);
    card.appendChild(label);
    grid.appendChild(card);

    const fromCurve =
      pair.from === "circle-fast"
        ? fastCircleCurve
        : (
            curves as Record<
              string,
              {
                fn: (...args: unknown[]) => { x: number; y: number };
                period?: number;
                speed?: number;
                name?: string;
              }
            >
          )[pair.from];
    const toCurve = (
      curves as Record<
        string,
        {
          fn: (...args: unknown[]) => { x: number; y: number };
          period?: number;
          speed?: number;
          name?: string;
        }
      >
    )[pair.to];

    if (!fromCurve || !toCurve) continue;

    const color = "#c0143c";
    const sarmal = createSarmal(canvas, fromCurve as Parameters<typeof createSarmal>[1], {
      trailColor: color,
      skeletonColor: color,
      headColor: color,
      trailLength: 60,
    });

    sarmal.start();

    let morphing = false;
    let morphed = false;

    btn.addEventListener("click", async () => {
      if (morphing) return;
      morphing = true;
      btn.textContent = "...";
      btn.disabled = true;

      const target = morphed ? fromCurve : toCurve;
      await sarmal.morphTo(target as Parameters<typeof createSarmal>[1], { duration: 300 });

      morphed = !morphed;
      morphing = false;
      btn.textContent = morphed ? "Reset" : "Morph";
      btn.disabled = false;
    });
  }
}

setupMorphDemo();
