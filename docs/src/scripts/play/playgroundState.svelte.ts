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

import { onDestroy, onMount } from "svelte";
import { palettes } from "@sarmal/core";
import { buildCurveFn, extractBody, sampleCurveFn, isEachSamplesEqual } from "./curve";
import { createInstance, getResolvedTrailColor, getResolvedSkeletonColor } from "./renderer";
import { handleShare } from "./share";
import { DEFAULT_CODE } from "./types";

export interface PlaygroundState {
  currentMode: PlaygroundMode;
  currentCode: string;
  error: string | null;
  showSkeleton: boolean;
  speed: number;
  trailLength: number;
  headRadius: number;
  trailStyle: TrailStyle;
  trailColor: string;
  headColor: string;
  headColorAuto: boolean;
  palette: SarmalPalette;
  presetId: string;
  shareStatus: string | null;
  sidebarVisible: boolean;
  instance: ReturnType<typeof createInstance> | null;
  lastCompiledCode: string;
  lastCompiledFn: CurveFn | null;
  isSliding: boolean;
  drawBoardRef: DrawBoardExports | null;
  drawInitialPoints: Array<DrawingSegment> | undefined;
  drawPoints: Array<DrawingSegment>;
  showDrawControls: boolean;
  drawPointCount: number;
  shouldShowDrawControls: boolean;
  paletteColors: string;
  isPaletteAnimated: boolean;
  showPalette: boolean;
  resolvedTrailColor: string | string[];
  resolvedSkeletonColor: string;
  loadPreset: (curveId: string) => void;
  handleCodeChange: () => void;
  handleClear: () => void;
  switchMode: (mode: PlaygroundMode) => void;
  handleSkeletonToggle: () => void;
  handleSpeedChange: (newSpeed: number) => void;
  handleTrailLengthChange: (newLength: number) => void;
  handleTrailLengthCommit: () => void;
  handleHeadRadiusChange: (newRadius: number) => void;
  handleTrailColorChange: (newColor: string) => void;
  handleHeadColorChange: (newColor: string) => void;
  handleHeadColorAutoChange: (auto: boolean) => void;
  handleTrailStyleChange: (newStyle: TrailStyle) => void;
  handlePaletteChange: (newPalette: SarmalPalette) => void;
  handleShareClick: () => Promise<void>;
  canvasRef: { current: HTMLCanvasElement | null };
  presets: PresetData[];
  PRESETS: Record<string, Preset>;
}

export function createPlaygroundState(
  canvasRef: { current: HTMLCanvasElement | null },
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
    headRadius: 4,
    trailStyle: "default" as TrailStyle,
    trailColor: "#c0143c",
    headColor: "#c0143c",
    headColorAuto: true,
    headRadiusAuto: true,
    palette: "bard" as SarmalPalette,
    presetId: "",
    shareStatus: null as string | null,
    sidebarVisible: false,
    instance: null as ReturnType<typeof createInstance> | null,
    lastCompiledCode: "",
    lastCompiledFn: null as CurveFn | null,
    isSliding: false,
    drawBoardRef: null as DrawBoardExports | null,
    drawInitialPoints: undefined as Array<DrawingSegment> | undefined,
    drawPoints: [] as Array<DrawingSegment>,
    showDrawControls: true,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let slideTimer: ReturnType<typeof setTimeout> | null = null;

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

  function loadPreset(curveId: string) {
    const preset = PRESETS[curveId];
    if (!preset) {
      return;
    }

    state.presetId = curveId;
    state.sidebarVisible = false;
    const body = extractBody(preset.fn);
    state.currentCode = body;
    state.error = null;

    const result = buildCurveFn(body);
    if (result.ok) {
      rebuildInstance(result.fn, preset.period);
      state.lastCompiledCode = body;
      state.lastCompiledFn = result.fn;
    }
  }

  function rebuildInstance(fn: CurveFn, period = Math.PI * 2) {
    if (state.instance) {
      state.instance.destroy();
      state.instance = null;
    }

    const c = canvasRef.current;
    if (!c) {
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
        headRadius: state.headRadiusAuto ? undefined : state.headRadius,
        trailLength: state.trailLength,
        speed: state.speed,
        trailStyle: state.trailStyle,
      },
      period,
    );
  }

  function handleCodeChange() {
    state.error = null;
    state.presetId = "";

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (state.currentCode === state.lastCompiledCode) {
        return;
      }

      const result = buildCurveFn(state.currentCode);
      if (!result.ok) {
        state.error = result.error;
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
        newSamples = sampleCurveFn(result.fn);
      } catch {
        state.error = "Curve function produces invalid output for some values";
        return;
      }

      if (oldSamples && newSamples && isEachSamplesEqual(oldSamples, newSamples)) {
        return;
      }

      rebuildInstance(result.fn);
      state.lastCompiledCode = state.currentCode;
      state.lastCompiledFn = result.fn;
    }, 150);
  }

  function handleClear() {
    if (state.currentMode === "math") {
      state.currentCode = "";
      state.error = null;
      state.presetId = "";

      if (state.instance) {
        state.instance.destroy();
        state.instance = null;
      }
      state.lastCompiledCode = "";
      state.lastCompiledFn = null;
    } else {
      state.drawBoardRef?.clearPoints();
      state.showDrawControls = true;
    }
    history.replaceState(null, "", window.location.pathname);
  }

  function handleModeSwitch(mode: PlaygroundMode) {
    if (mode === "draw") {
      if (state.instance) {
        state.instance.destroy();
        state.instance = null;
      }

      const c = canvasRef.current;
      if (c) {
        c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      }
    } else {
      state.error = null;
      const result = buildCurveFn(state.currentCode);
      if (result.ok) {
        rebuildInstance(result.fn);
        state.lastCompiledCode = state.currentCode;
        state.lastCompiledFn = result.fn;
      }
    }

    state.currentMode = mode;

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

    if (state.currentMode === "draw" && state.showDrawControls && drawPointCount >= 3) {
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

  function handleTrailLengthCommit() {
    if (state.currentMode === "math") {
      const result = buildCurveFn(state.currentCode);

      if (result.ok) {
        rebuildInstance(result.fn);
      }
    } else {
      state.drawBoardRef?.rebuildInstance();
    }
  }

  function handleHeadRadiusChange(newRadius: number) {
    state.headRadius = newRadius;
    state.headRadiusAuto = false;
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

  async function handleShareClick() {
    if (!state.currentCode && state.currentMode === "math") {
      return;
    }
    if (state.currentMode === "draw" && drawPointCount < 3) {
      return;
    }

    const payload: SharedState = {
      v: 2,
      mode: state.currentMode,
      code: state.currentMode === "draw" ? "" : state.currentCode,
      trailStyle: state.trailStyle,
      palette: state.palette,
      trailColor: state.trailColor,
      headColor: state.headColor,
      headColorAuto: state.headColorAuto,
      headRadius: state.headRadius,
      trailLength: state.trailLength,
      speed: state.speed,
      showSkeleton: state.showSkeleton,
    };

    if (state.currentMode === "draw") {
      payload.drawPoints = state.drawBoardRef?.getPoints();
    }

    const c = canvasRef.current;
    if (!c) {
      return;
    }

    const result = await handleShare(c, payload);
    if (result.ok) {
      state.shareStatus = "Link copied. Expires in 90 days.";
      setTimeout(() => {
        state.shareStatus = null;
      }, 3000);
    } else {
      state.shareStatus = result.error;
      setTimeout(() => {
        state.shareStatus = null;
      }, 4000);
    }
  }

  async function restoreState(saved: SharedState) {
    if (saved.mode === "draw" && saved.drawPoints) {
      state.drawInitialPoints = saved.drawPoints;
      state.drawPoints = [...saved.drawPoints];

      state.currentMode = "draw";
    } else {
      state.currentCode = saved.code;
      state.error = null;
      const result = buildCurveFn(saved.code);
      if (result.ok) {
        rebuildInstance(result.fn);
        state.lastCompiledCode = saved.code;
        state.lastCompiledFn = result.fn;
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
      state.headRadiusAuto = false;
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
  });

  onMount(async () => {
    window.addEventListener("beforeunload", handleBeforeUnload);

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

    const result = buildCurveFn(DEFAULT_CODE);
    if (result.ok) {
      rebuildInstance(result.fn);
      state.lastCompiledCode = DEFAULT_CODE;
      state.lastCompiledFn = result.fn;
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
    get shareStatus() {
      return state.shareStatus;
    },
    set shareStatus(v) {
      state.shareStatus = v;
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
    handleShareClick,
    get PRESETS() {
      return PRESETS;
    },
    canvasRef,
    presets,
  };
}
