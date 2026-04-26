import type { SharedState } from "./state";
import type { Point, TrailStyle } from "@sarmal/core";
import type { Preset, PresetData } from "./types";

import { palettes } from "@sarmal/core";

import {
  clearBtn,
  codeInput,
  colorInput,
  headColorAutoCheckbox,
  headColorInput,
  paletteContainer,
  palettePreview,
  paletteSelect,
  colorControlsDiv,
  presetsDataEl,
  presetSelect,
  shareBtn,
  skeletonToggle,
  speedSlider,
  speedValue,
  trailSlider,
  trailStyleSelect,
  trailValue,
} from "./dom";
import { state, DEFAULT_CODE } from "./state";
import {
  buildCurveFn,
  clearError,
  extractBody,
  sampleCurveFn,
  isEachSamplesEqual,
  showError,
} from "./curve";
import {
  createInstance,
  getParams,
  getResolvedSkeletonColor,
  getResolvedTrailColor,
  updateSpeed,
  updateTrailLength,
} from "./renderer";
import { handleShare } from "./share";

const presetsData: PresetData[] = JSON.parse(presetsDataEl.textContent || "[]");
const PRESETS: Record<string, Preset> = presetsData.reduce(
  (acc, c) => {
    acc[c.id] = { fn: c.fn, period: c.period ?? Math.PI * 2 };
    return acc;
  },
  {} as Record<string, Preset>,
);

function loadPreset(curveId: string) {
  const preset = PRESETS[curveId];
  if (!preset) {
    return;
  }

  const body = extractBody(preset.fn);
  codeInput.value = body;
  state.currentCode = body;
  clearError();

  const fn = buildCurveFn(body);
  if (fn) {
    createInstance(fn, getParams(), preset.period);
  }
}

function handleCodeChange() {
  clearError();
  state.currentCode = codeInput.value;

  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
  }

  state.debounceTimer = setTimeout(() => {
    if (state.currentCode === state.lastCompiledCode) {
      return;
    }

    const fn = buildCurveFn(state.currentCode);
    if (!fn) {
      return;
    }

    let oldSamples: Point[] | undefined;
    try {
      if (state.lastCompiledFn) {
        oldSamples = sampleCurveFn(state.lastCompiledFn);
      }
    } catch {
      // Old function throws at some samples; treat as different
    }

    let newSamples: Point[] | undefined;
    try {
      newSamples = sampleCurveFn(fn);
    } catch {
      showError("Curve function produces invalid output for some values");
      return;
    }

    if (oldSamples && newSamples && isEachSamplesEqual(oldSamples, newSamples)) {
      return;
    }

    createInstance(fn, getParams());
  }, 150);
}

function handleClear() {
  codeInput.value = "";
  state.currentCode = "";
  history.replaceState(null, "", window.location.pathname);
  clearError();

  if (state.currentInstance) {
    state.currentInstance.destroy();
    state.currentInstance = null;
  }
  state.lastCompiledCode = "";
  state.lastCompiledFn = null;
}

function handleSkeletonToggle() {
  state.showSkeleton = !state.showSkeleton;
  const knob = skeletonToggle.querySelector("span");

  if (state.showSkeleton) {
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

  state.currentInstance?.setRenderOptions({
    skeletonColor: getResolvedSkeletonColor(),
  });
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

function restoreState(savedState: SharedState) {
  codeInput.value = savedState.code;
  state.currentCode = savedState.code;

  if (savedState.trailStyle) {
    trailStyleSelect.value = savedState.trailStyle;
  }

  if (savedState.palette) {
    paletteSelect.value = savedState.palette;
  }

  if (savedState.trailColor) {
    colorInput.value = savedState.trailColor;
  }

  if (savedState.headColor) {
    headColorInput.value = savedState.headColor;
  }

  if (typeof savedState.headColorAuto === "boolean") {
    headColorAutoCheckbox.checked = savedState.headColorAuto;
  }

  if (typeof savedState.trailLength === "number") {
    trailSlider.value = String(savedState.trailLength);
    trailValue.textContent = String(savedState.trailLength);
  }

  if (typeof savedState.speed === "number") {
    speedSlider.value = String(savedState.speed);
    speedValue.textContent = savedState.speed.toFixed(1);
  }

  if (
    typeof savedState.showSkeleton === "boolean" &&
    savedState.showSkeleton !== state.showSkeleton
  ) {
    handleSkeletonToggle();
  }

  updatePaletteVisibility();
  updateHeadColorInputState();

  clearError();
  const fn = buildCurveFn(savedState.code);
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
  state.currentInstance?.setRenderOptions({
    ...(style === "default" ? { trailColor: colorInput.value } : {}),
    skeletonColor: getResolvedSkeletonColor(),
  });
  if (style === "default" && headColorAutoCheckbox.checked) {
    headColorInput.value = colorInput.value;
  }
});

headColorInput.addEventListener("input", () => {
  if (!headColorAutoCheckbox.checked) {
    state.currentInstance?.setRenderOptions({ headColor: headColorInput.value });
  }
});

headColorAutoCheckbox.addEventListener("change", () => {
  updateHeadColorInputState();
  state.currentInstance?.setRenderOptions({
    headColor: headColorAutoCheckbox.checked ? null : headColorInput.value,
  });
});

trailStyleSelect.addEventListener("change", () => {
  updatePaletteVisibility();
  state.currentInstance?.setRenderOptions({
    trailStyle: trailStyleSelect.value as TrailStyle,
    trailColor: getResolvedTrailColor(),
    skeletonColor: getResolvedSkeletonColor(),
  });
  if (headColorAutoCheckbox.checked) {
    const style = trailStyleSelect.value as TrailStyle;
    if (style === "default") {
      headColorInput.value = colorInput.value;
    } else {
      const palette = palettes[paletteSelect.value as keyof typeof palettes];
      if (palette) headColorInput.value = palette[palette.length - 1]!;
    }
  }
});

paletteSelect.addEventListener("change", () => {
  updatePalettePreview();
  const style = trailStyleSelect.value as TrailStyle;
  if (style !== "default") {
    state.currentInstance?.setRenderOptions({
      trailColor: getResolvedTrailColor(),
      skeletonColor: getResolvedSkeletonColor(),
    });
    if (headColorAutoCheckbox.checked) {
      const palette = palettes[paletteSelect.value as keyof typeof palettes];
      if (palette) headColorInput.value = palette[palette.length - 1]!;
    }
  }
});

async function init(): Promise<void> {
  const searchParams = new URLSearchParams(window.location.search);
  const shareId = searchParams.get("s");

  updatePaletteVisibility();
  updateHeadColorInputState();

  if (shareId) {
    try {
      const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
      if (res.ok) {
        const { state: savedState } = (await res.json()) as { state: SharedState };
        restoreState(savedState);
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
