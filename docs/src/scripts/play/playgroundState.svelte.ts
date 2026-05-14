import type {
  PresetData,
  SharedState,
  CurveFn,
  PlaygroundMode,
  Preset,
  DrawBoardExports,
} from "./types";
import type { Point, TrailStyle, SarmalPalette } from "@sarmal/core";
import type { DrawingSegment } from "./types";

import { onDestroy, onMount, tick } from "svelte";
import { palettes } from "@sarmal/core";

import { buildCurveFn, extractBody, sampleCurveFn, isEachSamplesEqual } from "./curve";
import { createInstance, getResolvedTrailColor, getResolvedSkeletonColor } from "./renderer";
import { compile, preSample, createLookupFn, createEvalLoop, createSandboxWorker } from "./sandbox";

import { DEFAULT_CODE } from "./types";

export interface PlaygroundState {
  currentMode: PlaygroundMode;
  currentCode: string;
  error: string | null;
  showSkeleton: boolean;
  speed: number;
  trailLength: number;
  headRadius: number | null;
  trailStyle: TrailStyle;
  trailColor: string;
  headColor: string;
  headColorAuto: boolean;
  palette: SarmalPalette;
  presetId: string;
  activePeriod: number;
  sidebarVisible: boolean;
  instance: ReturnType<typeof createInstance> | null;
  lastCompiledCode: string;
  lastCompiledFn: CurveFn | null;
  lastCompiledSamples: Point[] | null;
  isSliding: boolean;
  drawBoardRef: DrawBoardExports | null;
  drawInitialPoints: Array<DrawingSegment> | undefined;
  drawPoints: Array<DrawingSegment>;
  showDrawControls: boolean;
  drawPointCount: number;
  shouldShowDrawControls: boolean;
  mouseSVGX: number;
  mouseSVGY: number;
  paletteColors: string;
  isPaletteAnimated: boolean;
  showPalette: boolean;
  resolvedTrailColor: string | string[];
  resolvedSkeletonColor: string;
  loadPreset: (curveId: string) => Promise<void>;
  handleCodeChange: () => void;
  handleClear: () => void;
  switchMode: (mode: PlaygroundMode) => void;
  handleSkeletonToggle: () => void;
  handleSpeedChange: (newSpeed: number) => void;
  handleTrailLengthChange: (newLength: number) => void;
  handleTrailLengthCommit: () => Promise<void>;
  handleHeadRadiusChange: (newRadius: number) => void;
  handleTrailColorChange: (newColor: string) => void;
  handleHeadColorChange: (newColor: string) => void;
  handleHeadColorAutoChange: (auto: boolean) => void;
  handleTrailStyleChange: (newStyle: TrailStyle) => void;
  handlePaletteChange: (newPalette: SarmalPalette) => void;
  handleDrawPointChange: (index: number, axis: "x" | "y", value: number) => void;
  previewRef: { current: SVGSVGElement | null };
  presets: PresetData[];
  PRESETS: Record<string, Preset>;
}

export function createPlaygroundState(
  previewRef: { current: SVGSVGElement | null },
  showConfirm: (title: string, message: string, onConfirm: () => void) => void,
  presets: PresetData[],
  savedState?: SharedState | null,
): PlaygroundState {
  const state = $state({
    currentMode: "math" as PlaygroundMode,
    currentCode: DEFAULT_CODE,
    error: null as string | null,
    showSkeleton: true,
    speed: 1,
    trailLength: 120,
    headRadius: null as number | null,
    trailStyle: "default" as TrailStyle,
    trailColor: "#c0143c",
    headColor: "#c0143c",
    headColorAuto: true,
    palette: "bard" as SarmalPalette,
    presetId: "",
    activePeriod: Math.PI * 2,
    sidebarVisible: false,
    instance: null as ReturnType<typeof createInstance> | null,
    lastCompiledCode: "",
    lastCompiledFn: null as CurveFn | null,
    lastCompiledSamples: null as Point[] | null,
    isSliding: false,
    drawBoardRef: null as DrawBoardExports | null,
    drawInitialPoints: undefined as Array<DrawingSegment> | undefined,
    drawPoints: [] as Array<DrawingSegment>,
    showDrawControls: true,
    mouseSVGX: 0,
    mouseSVGY: 0,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let slideTimer: ReturnType<typeof setTimeout> | null = null;
  let sandboxWorker: Worker | null = null;
  let evalLoopDispose: (() => void) | null = null;
  let compileVersion = 0;

  const drawPointCount = $derived(state.drawPoints.length);
  const shouldShowDrawControls = $derived(state.showDrawControls || drawPointCount < 3);

  const PRESETS = $derived(
    presets.reduce(
      (acc, c) => {
        acc[c.id] = { fn: c.fn, period: c.period ?? Math.PI * 2 };
        return acc;
      },
      {} as Record<string, Preset>,
    ),
  );

  async function loadPreset(curveId: string) {
    const preset = PRESETS[curveId];
    if (!preset) {
      return;
    }

    state.presetId = curveId;
    state.activePeriod = preset.period;
    state.sidebarVisible = false;
    const body = extractBody(preset.fn);
    state.currentCode = body;
    state.error = null;

    // quick one first
    const localResult = buildCurveFn(body);
    if (!localResult.ok) {
      state.error = localResult.error;
      return;
    }

    const sandboxResult = await compileSandboxed(body, preset.period);
    if (!sandboxResult.ok) {
      if (sandboxResult.error !== "Superseded") {
        state.error = sandboxResult.error;
      }
      return;
    }

    rebuildInstance(sandboxResult.fn, preset.period);
    state.lastCompiledCode = body;
    state.lastCompiledFn = sandboxResult.fn;
    state.lastCompiledSamples = sandboxResult.dedupSamples;
  }

  function rebuildInstance(fn: CurveFn, period = Math.PI * 2) {
    if (state.instance) {
      state.instance.destroy();
      state.instance = null;
    }

    const c = previewRef.current;
    if (!(c instanceof SVGSVGElement)) {
      return;
    }

    state.instance = createInstance(
      c,
      fn,
      {
        trailColor: getResolvedTrailColor(state.trailStyle, state.palette, state.trailColor),
        skeletonColor: getResolvedSkeletonColor(
          state.showSkeleton,
          state.trailStyle,
          state.palette,
          state.trailColor,
        ),
        headColor: state.headColorAuto ? undefined : state.headColor,
        headRadius: state.headRadius ?? undefined,
        trailLength: state.trailLength,
        speed: state.speed,
        trailStyle: state.trailStyle,
      },
      period,
    );
  }

  /**
   * Compiles user code in the Web Worker sandbox when available.
   *
   * When the Worker is available, it is the **only** compilation path.
   * ! Failed Worker compiles never fall through to main-thread execution. The error is surfaced directly.
   * The `buildCurveFn` fallback exists solely for environments without Worker support.
   *
   * - Static curves: Sampled into a lookup table. The Worker **stands down** after sampling.
   * - Dynamic curves: The Worker stays live, evaluating per-frame through `postMessage`.
   * - No Worker support: falls back to main-thread `buildCurveFn`.
   *
   * ! Uses a version counter to discard stale results when the user edits code faster than the Worker can respond.
   */
  async function compileSandboxed(
    code: string,
    period: number,
  ): Promise<{ ok: true; fn: CurveFn; dedupSamples: Point[] } | { ok: false; error: string }> {
    const myVersion = ++compileVersion;

    if (sandboxWorker) {
      try {
        const discardedResult = { ok: false, error: "Superseded" } as const;

        const result = await compile(sandboxWorker, code);
        if (myVersion !== compileVersion) {
          return discardedResult;
        }

        if (!result.ok) {
          evalLoopDispose?.();
          evalLoopDispose = null;
          return { ok: false, error: result.error };
        }

        if (!result.isTimeVariant) {
          evalLoopDispose?.();
          evalLoopDispose = null;
          const samples = await preSample(sandboxWorker, period);
          if (myVersion !== compileVersion) {
            return discardedResult;
          }
          return {
            ok: true,
            fn: createLookupFn(samples, period),
            dedupSamples: result.dedupSamples,
          };
        }

        // Dynamic curve: pre-sample skeleton at elapsed=0 for valid initial bounding box
        evalLoopDispose?.();
        const skeletonSamples = await preSample(sandboxWorker, period);
        if (myVersion !== compileVersion) {
          return discardedResult;
        }

        const loop = createEvalLoop(sandboxWorker, skeletonSamples, period);
        evalLoopDispose = loop.dispose;
        return { ok: true, fn: loop.proxyFn, dedupSamples: result.dedupSamples };
      } catch {
        evalLoopDispose?.();
        evalLoopDispose = null;
        return { ok: false, error: "Sandbox compilation failed" };
      }
    }

    // No Worker support: compile on main thread
    const result = buildCurveFn(code);
    if (result.ok) {
      return { ok: true, fn: result.fn, dedupSamples: sampleCurveFn(result.fn) };
    }
    return { ok: false, error: result.error };
  }

  function handleCodeChange() {
    state.error = null;
    state.presetId = "";

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      if (state.currentCode === state.lastCompiledCode) {
        return;
      }

      const sandboxResult = await compileSandboxed(state.currentCode, state.activePeriod);
      if (!sandboxResult.ok) {
        if (sandboxResult.error !== "Superseded") {
          state.error = sandboxResult.error;
        }
        return;
      }

      if (
        state.lastCompiledSamples &&
        isEachSamplesEqual(state.lastCompiledSamples, sandboxResult.dedupSamples)
      ) {
        state.lastCompiledCode = state.currentCode;
        return;
      }

      rebuildInstance(sandboxResult.fn, state.activePeriod);
      state.lastCompiledCode = state.currentCode;
      state.lastCompiledFn = sandboxResult.fn;
      state.lastCompiledSamples = sandboxResult.dedupSamples;
    }, 150);
  }

  function handleClear() {
    if (state.currentMode === "math") {
      state.currentCode = "";
      state.error = null;
      state.presetId = "";
      state.activePeriod = Math.PI * 2;

      if (state.instance) {
        state.instance.destroy();
        state.instance = null;
      }
      state.lastCompiledCode = "";
      state.lastCompiledFn = null;
      state.lastCompiledSamples = null;
    } else {
      state.drawBoardRef?.clearPoints();
      state.showDrawControls = true;
    }
    history.replaceState(null, "", window.location.pathname);
  }

  async function handleModeSwitch(mode: PlaygroundMode) {
    state.currentMode = mode;

    if (mode === "draw") {
      state.currentCode = DEFAULT_CODE;
      state.lastCompiledCode = "";
      state.lastCompiledFn = null;
      state.lastCompiledSamples = null;
      state.error = null;
      state.presetId = "";

      if (state.instance) {
        state.instance.destroy();
        state.instance = null;
      }
    } else {
      state.showDrawControls = true;

      state.error = null;
      const sandboxResult = await compileSandboxed(state.currentCode, state.activePeriod);
      if (sandboxResult.ok) {
        state.lastCompiledCode = state.currentCode;
        state.lastCompiledFn = sandboxResult.fn;
        state.lastCompiledSamples = sandboxResult.dedupSamples;
        await tick();
        rebuildInstance(sandboxResult.fn, state.activePeriod);
      } else if (sandboxResult.error !== "Superseded") {
        state.error = sandboxResult.error;
      }
    }

    state.isSliding = false;
    requestAnimationFrame(() => {
      state.isSliding = true;
    });
    if (slideTimer) clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
      state.isSliding = false;
    }, 450);
  }

  function switchMode(mode: PlaygroundMode) {
    if (state.currentMode === mode) {
      return;
    }

    if (state.currentMode === "draw" && drawPointCount >= 3) {
      showConfirm(
        "Leave drawing mode?",
        `You have ${drawPointCount} control point${drawPointCount > 1 ? "s" : ""}. Switching to math mode will discard them.`,
        () => handleModeSwitch(mode),
      );
      return;
    }

    if (
      state.currentMode === "math" &&
      state.currentCode !== state.lastCompiledCode &&
      state.currentCode.trim() !== ""
    ) {
      showConfirm(
        "Leave math mode?",
        "You have unsaved changes to the curve definition. Switching will lose your progress.",
        () => handleModeSwitch(mode),
      );
      return;
    }

    handleModeSwitch(mode);
  }

  function handleBeforeUnload(e: BeforeUnloadEvent) {
    const hasWork =
      (state.currentMode === "draw" && drawPointCount >= 3) ||
      (state.currentMode === "math" &&
        state.currentCode !== state.lastCompiledCode &&
        state.currentCode !== DEFAULT_CODE &&
        state.currentCode.trim() !== "");

    if (hasWork) {
      e.preventDefault();
    }
  }

  function handleSkeletonToggle() {
    state.showSkeleton = !state.showSkeleton;
    const color = getResolvedSkeletonColor(
      state.showSkeleton,
      state.trailStyle,
      state.palette,
      state.trailColor,
    );
    if (state.currentMode === "math") {
      state.instance?.setRenderOptions({ skeletonColor: color });
    }
  }

  function handleSpeedChange(newSpeed: number) {
    state.speed = newSpeed;
    if (state.currentMode === "math") {
      state.instance?.setSpeed(newSpeed);
    }
  }

  function handleTrailLengthChange(newLength: number) {
    state.trailLength = newLength;
  }

  async function handleTrailLengthCommit() {
    if (state.currentMode === "math") {
      const sandboxResult = await compileSandboxed(state.currentCode, state.activePeriod);
      if (sandboxResult.ok) {
        rebuildInstance(sandboxResult.fn, state.activePeriod);
      }
    } else {
      state.drawBoardRef?.rebuildInstance();
    }
  }

  function handleHeadRadiusChange(newRadius: number) {
    state.headRadius = newRadius;
    if (state.currentMode === "math") {
      state.instance?.setRenderOptions({ headRadius: newRadius });
    }
  }

  function handleTrailColorChange(newColor: string) {
    state.trailColor = newColor;
    if (state.currentMode === "math") {
      state.instance?.setRenderOptions({
        ...(state.trailStyle === "default" ? { trailColor: newColor } : {}),
        skeletonColor: getResolvedSkeletonColor(
          state.showSkeleton,
          state.trailStyle,
          state.palette,
          state.trailColor,
        ),
      });
    }

    if (state.trailStyle === "default" && state.headColorAuto) {
      state.headColor = newColor;
    }
  }

  function handleHeadColorChange(newColor: string) {
    state.headColor = newColor;
    if (!state.headColorAuto && state.currentMode === "math") {
      state.instance?.setRenderOptions({ headColor: newColor });
    }
  }

  function handleHeadColorAutoChange(auto: boolean) {
    state.headColorAuto = auto;

    if (state.currentMode === "math") {
      state.instance?.setRenderOptions({
        headColor: auto ? null : state.headColor,
      });
    }
  }

  function handleTrailStyleChange(newStyle: TrailStyle) {
    state.trailStyle = newStyle;

    if (state.currentMode === "math") {
      state.instance?.setRenderOptions({
        trailStyle: newStyle,
        trailColor: getResolvedTrailColor(newStyle, state.palette, state.trailColor),
        skeletonColor: getResolvedSkeletonColor(
          state.showSkeleton,
          newStyle,
          state.palette,
          state.trailColor,
        ),
      });
    }

    if (state.headColorAuto) {
      if (newStyle === "default") {
        state.headColor = state.trailColor;
      } else {
        const p = palettes[state.palette];
        if (p) {
          state.headColor = p[p.length - 1]!;
        }
      }
    }
  }

  function handlePaletteChange(newPalette: SarmalPalette) {
    state.palette = newPalette;

    if (state.trailStyle !== "default") {
      if (state.currentMode === "math") {
        state.instance?.setRenderOptions({
          trailColor: getResolvedTrailColor(state.trailStyle, newPalette, state.trailColor),
          skeletonColor: getResolvedSkeletonColor(
            state.showSkeleton,
            state.trailStyle,
            newPalette,
            state.trailColor,
          ),
        });
      }

      if (state.headColorAuto) {
        const p = palettes[newPalette as keyof typeof palettes];

        if (p) {
          state.headColor = p[p.length - 1]!;
        }
      }
    }
  }

  function handleDrawPointChange(index: number, axis: "x" | "y", value: number) {
    if (state.currentMode !== "draw") {
      return;
    }

    if (isNaN(value)) {
      return;
    }

    state.drawBoardRef?.updatePointAt(index, axis === "x" ? 0 : 1, Number(value.toFixed(3)));
  }

  async function restoreState(saved: SharedState) {
    if (saved.mode === "draw" && saved.drawPoints) {
      state.drawInitialPoints = saved.drawPoints;
      state.drawPoints = [...saved.drawPoints];

      state.currentMode = "draw";
    } else {
      state.currentCode = saved.code;
      state.error = null;
      state.activePeriod = saved.activePeriod ?? Math.PI * 2;
      const sandboxResult = await compileSandboxed(saved.code, state.activePeriod);
      if (sandboxResult.ok) {
        rebuildInstance(sandboxResult.fn, state.activePeriod);
        state.lastCompiledCode = saved.code;
        state.lastCompiledFn = sandboxResult.fn;
        state.lastCompiledSamples = sandboxResult.dedupSamples;
      } else if (sandboxResult.error !== "Superseded") {
        state.error = sandboxResult.error;
      }
    }

    if (saved.trailStyle) {
      state.trailStyle = saved.trailStyle as TrailStyle;
    }
    if (saved.palette) {
      state.palette = saved.palette as typeof state.palette;
    }
    if (saved.trailColor) {
      state.trailColor = saved.trailColor;
    }
    if (saved.headColor) {
      state.headColor = saved.headColor;
    }
    if (typeof saved.headColorAuto === "boolean") {
      state.headColorAuto = saved.headColorAuto;
    }
    if (typeof saved.headRadius === "number") {
      state.headRadius = saved.headRadius;
    }
    if (typeof saved.trailLength === "number") {
      state.trailLength = saved.trailLength;
    }
    if (typeof saved.speed === "number") {
      state.speed = saved.speed;
    }
    if (typeof saved.showSkeleton === "boolean" && saved.showSkeleton !== state.showSkeleton) {
      state.showSkeleton = saved.showSkeleton;
    }
  }

  onDestroy(() => {
    window.removeEventListener("beforeunload", handleBeforeUnload);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (slideTimer) {
      clearTimeout(slideTimer);
    }

    if (sandboxWorker) {
      evalLoopDispose?.();
      sandboxWorker.terminate();
      sandboxWorker = null;
      evalLoopDispose = null;
    }
  });

  onMount(async () => {
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Worker should be ready before the user types anything
    sandboxWorker = createSandboxWorker();

    if (savedState) {
      restoreState(savedState);
      return;
    }

    const shareId = new URLSearchParams(window.location.search).get("s");
    if (shareId) {
      try {
        const res = await fetch(`/api/share?id=${encodeURIComponent(shareId)}`);
        if (res.ok) {
          const { state: saved } = (await res.json()) as { state: SharedState };
          restoreState(saved);
          return;
        }
      } catch {
        // fall through to default
      }
    }

    const sandboxResult = await compileSandboxed(DEFAULT_CODE, Math.PI * 2);
    if (sandboxResult.ok) {
      rebuildInstance(sandboxResult.fn);
      state.lastCompiledCode = DEFAULT_CODE;
      state.lastCompiledFn = sandboxResult.fn;
      state.lastCompiledSamples = sandboxResult.dedupSamples;
    }
  });

  const paletteColors = $derived.by(() => {
    const p = palettes[state.palette];
    if (!p) {
      return state.trailColor;
    }
    const colors = [...p, p[0]];

    return `linear-gradient(to right, ${colors.join(", ")})`;
  });

  const isPaletteAnimated = $derived(state.trailStyle === "gradient-animated");
  const showPalette = $derived(state.trailStyle !== "default");

  const resolvedTrailColor = $derived(
    getResolvedTrailColor(state.trailStyle, state.palette, state.trailColor),
  );
  const resolvedSkeletonColor = $derived(
    getResolvedSkeletonColor(state.showSkeleton, state.trailStyle, state.palette, state.trailColor),
  );

  return {
    get currentMode() {
      return state.currentMode;
    },
    set currentMode(v) {
      state.currentMode = v;
    },
    get currentCode() {
      return state.currentCode;
    },
    set currentCode(v) {
      state.currentCode = v;
    },
    get error() {
      return state.error;
    },
    set error(v) {
      state.error = v;
    },
    get showSkeleton() {
      return state.showSkeleton;
    },
    set showSkeleton(v) {
      state.showSkeleton = v;
    },
    get speed() {
      return state.speed;
    },
    set speed(v) {
      state.speed = v;
    },
    get trailLength() {
      return state.trailLength;
    },
    set trailLength(v) {
      state.trailLength = v;
    },
    get headRadius() {
      return state.headRadius;
    },
    set headRadius(v) {
      state.headRadius = v;
    },
    get trailStyle() {
      return state.trailStyle;
    },
    set trailStyle(v) {
      state.trailStyle = v;
    },
    get trailColor() {
      return state.trailColor;
    },
    set trailColor(v) {
      state.trailColor = v;
    },
    get headColor() {
      return state.headColor;
    },
    set headColor(v) {
      state.headColor = v;
    },
    get headColorAuto() {
      return state.headColorAuto;
    },
    set headColorAuto(v) {
      state.headColorAuto = v;
    },
    get palette() {
      return state.palette;
    },
    set palette(v) {
      state.palette = v;
    },
    get presetId() {
      return state.presetId;
    },
    set presetId(v) {
      state.presetId = v;
    },
    get sidebarVisible() {
      return state.sidebarVisible;
    },
    set sidebarVisible(v) {
      state.sidebarVisible = v;
    },
    get instance() {
      return state.instance;
    },
    set instance(v) {
      state.instance = v;
    },
    get lastCompiledCode() {
      return state.lastCompiledCode;
    },
    set lastCompiledCode(v) {
      state.lastCompiledCode = v;
    },
    get lastCompiledFn() {
      return state.lastCompiledFn;
    },
    set lastCompiledFn(v) {
      state.lastCompiledFn = v;
    },
    get lastCompiledSamples() {
      return state.lastCompiledSamples;
    },
    set lastCompiledSamples(v) {
      state.lastCompiledSamples = v;
    },
    get activePeriod() {
      return state.activePeriod;
    },
    set activePeriod(v) {
      state.activePeriod = v;
    },
    get isSliding() {
      return state.isSliding;
    },
    set isSliding(v) {
      state.isSliding = v;
    },
    get drawBoardRef() {
      return state.drawBoardRef;
    },
    set drawBoardRef(v) {
      state.drawBoardRef = v;
    },
    get drawInitialPoints() {
      return state.drawInitialPoints;
    },
    set drawInitialPoints(v) {
      state.drawInitialPoints = v;
    },
    get drawPoints() {
      return state.drawPoints;
    },
    set drawPoints(v) {
      state.drawPoints = v;
    },
    get showDrawControls() {
      return state.showDrawControls;
    },
    set showDrawControls(v) {
      state.showDrawControls = v;
    },
    get mouseSVGX() {
      return state.mouseSVGX;
    },
    set mouseSVGX(v) {
      state.mouseSVGX = v;
    },
    get mouseSVGY() {
      return state.mouseSVGY;
    },
    set mouseSVGY(v) {
      state.mouseSVGY = v;
    },
    get drawPointCount() {
      return drawPointCount;
    },
    get shouldShowDrawControls() {
      return shouldShowDrawControls;
    },
    get paletteColors() {
      return paletteColors;
    },
    get isPaletteAnimated() {
      return isPaletteAnimated;
    },
    get showPalette() {
      return showPalette;
    },
    get resolvedTrailColor() {
      return resolvedTrailColor;
    },
    get resolvedSkeletonColor() {
      return resolvedSkeletonColor;
    },
    loadPreset,
    handleCodeChange,
    handleClear,
    switchMode,
    handleSkeletonToggle,
    handleSpeedChange,
    handleTrailLengthChange,
    handleTrailLengthCommit,
    handleHeadRadiusChange,
    handleTrailColorChange,
    handleHeadColorChange,
    handleHeadColorAutoChange,
    handleTrailStyleChange,
    handlePaletteChange,
    handleDrawPointChange,
    get PRESETS() {
      return PRESETS;
    },
    previewRef,
    presets,
  };
}
