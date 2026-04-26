<script lang="ts">
  import type {
    PresetData,
    SharedState,
    CurveFn,
    PlaygroundMode,
  } from "./scripts/play/types";
  import type { TrailStyle } from "@sarmal/core";
  import type { DrawingSegment } from "./scripts/play/catmull-rom";

  import { onMount } from "svelte";
  import { palettes } from "@sarmal/core";
  import { Share2, Trash, Trash2 } from "@lucide/svelte";

  import {
    buildCurveFn,
    extractBody,
    sampleCurveFn,
    isEachSamplesEqual,
  } from "./scripts/play/curve";
  import {
    createInstance,
    getResolvedTrailColor,
    getResolvedSkeletonColor,
  } from "./scripts/play/renderer";
  import { handleShare } from "./scripts/play/share";
  import { DEFAULT_CODE } from "./scripts/play/types";

  interface Props {
    presets: PresetData[];
    savedState?: SharedState | null;
  }

  let { presets, savedState }: Props = $props();

  let canvas: HTMLCanvasElement;

  let currentMode = $state<PlaygroundMode>("math");
  let currentCode = $state(DEFAULT_CODE);
  let error = $state<string | null>(null);
  let showSkeleton = $state(true);
  let speed = $state(1);
  let trailLength = $state(120);
  let trailStyle = $state<TrailStyle>("default");
  let trailColor = $state("#c0143c");
  let headColor = $state("#c0143c");
  let headColorAuto = $state(true);
  let palette = $state<"bard" | "sunset" | "ocean" | "ice" | "fire" | "forest">(
    "bard",
  );
  let shareStatus = $state<string | null>(null);

  let instance = $state<ReturnType<typeof createInstance> | null>(null);
  let lastCompiledCode = $state("");
  let lastCompiledFn: CurveFn | null = $state(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  interface DrawBoardExports {
    getPoints: () => Array<DrawingSegment>;
    toggleAnimate: () => void;
    clearPoints: () => void;
    isAnimating: () => boolean;
    rebuildInstance: () => void;
  }

  let DrawBoard = $state<any>(null);
  let drawBoardRef = $state<DrawBoardExports | null>(null);
  let drawInitialPoints = $state<Array<DrawingSegment> | undefined>(undefined);
  let drawCanAnimate = $state(false);
  let drawIsAnimating = $state(false);

  const PRESETS = $derived(
    presets.reduce(
      (acc, c) => {
        acc[c.id] = { fn: c.fn, period: c.period ?? Math.PI * 2 };
        return acc;
      },
      {} as Record<string, { fn: string; period: number }>,
    ),
  );

  function loadPreset(curveId: string) {
    const preset = PRESETS[curveId];
    if (!preset) return;

    const body = extractBody(preset.fn);
    currentCode = body;
    error = null;

    const result = buildCurveFn(body);
    if (result.ok) {
      rebuildInstance(result.fn, preset.period);
    }
  }

  function rebuildInstance(fn: CurveFn, period = Math.PI * 2) {
    if (instance) {
      instance.destroy();
      instance = null;
    }

    instance = createInstance(
      canvas,
      fn,
      {
        trailColor: getResolvedTrailColor(trailStyle, palette, trailColor),
        skeletonColor: getResolvedSkeletonColor(
          showSkeleton,
          trailStyle,
          palette,
          trailColor,
        ),
        headColor: headColorAuto ? undefined : headColor,
        trailLength,
        speed,
        trailStyle,
      },
      period,
    );
  }

  function handleCodeChange() {
    error = null;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (currentCode === lastCompiledCode) return;

      const result = buildCurveFn(currentCode);
      if (!result.ok) {
        error = result.error;
        return;
      }

      let oldSamples: { x: number; y: number }[] | undefined;
      try {
        if (lastCompiledFn) {
          oldSamples = sampleCurveFn(lastCompiledFn);
        }
      } catch {
        // Old function throws at some samples; treat as different
      }

      let newSamples: { x: number; y: number }[] | undefined;
      try {
        newSamples = sampleCurveFn(result.fn);
      } catch {
        error = "Curve function produces invalid output for some values";
        return;
      }

      if (
        oldSamples &&
        newSamples &&
        isEachSamplesEqual(oldSamples, newSamples)
      ) {
        return;
      }

      rebuildInstance(result.fn);
      lastCompiledCode = currentCode;
      lastCompiledFn = result.fn;
    }, 150);
  }

  function handleClear() {
    if (currentMode === "math") {
      currentCode = "";
      error = null;
      if (instance) {
        instance.destroy();
        instance = null;
      }
      lastCompiledCode = "";
      lastCompiledFn = null;
    } else {
      drawBoardRef?.clearPoints();
    }
    history.replaceState(null, "", window.location.pathname);
  }

  function switchMode(mode: "math" | "draw") {
    if (currentMode === mode) return;

    if (mode === "draw") {
      if (instance) {
        instance.destroy();
        instance = null;
      }
      lastCompiledCode = "";
      lastCompiledFn = null;
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      if (!DrawBoard) {
        import("./scripts/play/DrawBoard.svelte").then((mod) => {
          DrawBoard = mod.default;
        });
      }
    } else {
      error = null;
      const result = buildCurveFn(currentCode);
      if (result.ok) {
        rebuildInstance(result.fn);
      }
    }

    currentMode = mode;
  }

  function handleSkeletonToggle() {
    showSkeleton = !showSkeleton;
    const color = getResolvedSkeletonColor(
      showSkeleton,
      trailStyle,
      palette,
      trailColor,
    );
    if (currentMode === "math") {
      instance?.setRenderOptions({ skeletonColor: color });
    }
  }

  function handleSpeedChange(newSpeed: number) {
    speed = newSpeed;
    if (currentMode === "math") {
      instance?.setSpeed(newSpeed);
    }
  }

  function handleTrailLengthChange(newLength: number) {
    trailLength = newLength;
    if (currentMode === "math") {
      const result = buildCurveFn(currentCode);
      if (result.ok) {
        rebuildInstance(result.fn);
      }
    } else {
      drawBoardRef?.rebuildInstance();
    }
  }

  function handleTrailColorChange(newColor: string) {
    trailColor = newColor;
    if (currentMode === "math") {
      instance?.setRenderOptions({
        ...(trailStyle === "default" ? { trailColor: newColor } : {}),
        skeletonColor: getResolvedSkeletonColor(
          showSkeleton,
          trailStyle,
          palette,
          trailColor,
        ),
      });
    }
    if (trailStyle === "default" && headColorAuto) {
      headColor = newColor;
    }
  }

  function handleHeadColorChange(newColor: string) {
    headColor = newColor;
    if (!headColorAuto && currentMode === "math") {
      instance?.setRenderOptions({ headColor: newColor });
    }
  }

  function handleHeadColorAutoChange(auto: boolean) {
    headColorAuto = auto;
    if (currentMode === "math") {
      instance?.setRenderOptions({
        headColor: auto ? null : headColor,
      });
    }
  }

  function handleTrailStyleChange(newStyle: TrailStyle) {
    trailStyle = newStyle;
    if (currentMode === "math") {
      instance?.setRenderOptions({
        trailStyle: newStyle,
        trailColor: getResolvedTrailColor(newStyle, palette, trailColor),
        skeletonColor: getResolvedSkeletonColor(
          showSkeleton,
          newStyle,
          palette,
          trailColor,
        ),
      });
    }
    if (headColorAuto) {
      if (newStyle === "default") {
        headColor = trailColor;
      } else {
        const p = palettes[palette];
        if (p) headColor = p[p.length - 1]!;
      }
    }
  }

  function handlePaletteChange(newPalette: string) {
    palette = newPalette as typeof palette;
    if (trailStyle !== "default") {
      if (currentMode === "math") {
        instance?.setRenderOptions({
          trailColor: getResolvedTrailColor(trailStyle, newPalette, trailColor),
          skeletonColor: getResolvedSkeletonColor(
            showSkeleton,
            trailStyle,
            newPalette,
            trailColor,
          ),
        });
      }
      if (headColorAuto) {
        const p = palettes[newPalette as keyof typeof palettes];
        if (p) headColor = p[p.length - 1]!;
      }
    }
  }

  async function handleShareClick() {
    if (!currentCode && currentMode === "math") return;

    const payload: SharedState = {
      v: 1,
      mode: currentMode,
      code: currentMode === "draw" ? "" : currentCode,
      trailStyle,
      palette,
      trailColor,
      headColor,
      headColorAuto,
      trailLength,
      speed,
      showSkeleton,
    };

    if (currentMode === "draw") {
      payload.drawPoints = drawBoardRef?.getPoints();
    }

    const result = await handleShare(canvas, payload);
    if (result.ok) {
      shareStatus = "Link copied. Expires in 90 days.";
      setTimeout(() => {
        shareStatus = null;
      }, 3000);
    } else {
      shareStatus = result.error;
      setTimeout(() => {
        shareStatus = null;
      }, 4000);
    }
  }

  function restoreState(saved: SharedState) {
    if (saved.mode === "draw" && saved.drawPoints) {
      currentMode = "draw";
      drawInitialPoints = saved.drawPoints;
      if (!DrawBoard) {
        import("./scripts/play/DrawBoard.svelte").then((mod) => {
          DrawBoard = mod.default;
        });
      }
    } else {
      currentCode = saved.code;
      error = null;
      const result = buildCurveFn(saved.code);
      if (result.ok) {
        rebuildInstance(result.fn);
      }
    }

    if (saved.trailStyle) {
      trailStyle = saved.trailStyle as TrailStyle;
    }
    if (saved.palette) {
      palette = saved.palette as typeof palette;
    }
    if (saved.trailColor) {
      trailColor = saved.trailColor;
    }
    if (saved.headColor) {
      headColor = saved.headColor;
    }
    if (typeof saved.headColorAuto === "boolean") {
      headColorAuto = saved.headColorAuto;
    }
    if (typeof saved.trailLength === "number") {
      trailLength = saved.trailLength;
    }
    if (typeof saved.speed === "number") {
      speed = saved.speed;
    }
    if (
      typeof saved.showSkeleton === "boolean" &&
      saved.showSkeleton !== showSkeleton
    ) {
      showSkeleton = saved.showSkeleton;
    }
  }

  onMount(async () => {
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
    }
  });

  const paletteColors = $derived.by(() => {
    const p = palettes[palette];
    if (!p) return trailColor;
    const colors = [...p, p[0]];
    return `linear-gradient(to right, ${colors.join(", ")})`;
  });

  const isPaletteAnimated = $derived(trailStyle === "gradient-animated");
  const showPalette = $derived(trailStyle !== "default");

  const resolvedTrailColor = $derived(
    getResolvedTrailColor(trailStyle, palette, trailColor),
  );
  const resolvedSkeletonColor = $derived(
    getResolvedSkeletonColor(showSkeleton, trailStyle, palette, trailColor),
  );
</script>

<div class="flex flex-col lg:flex-row h-[calc(100vh-57px)]">
  <section
    id="play-left-panel"
    class="group w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border"
  >
    <div
      class="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex border border-border rounded overflow-hidden"
          id="mode-toggle"
        >
          {#each ["math", "draw"] as mode}
            <button
              data-mode={mode}
              data-active={currentMode === mode ? "" : undefined}
              class="font-mono text-xs tracking-wider uppercase px-2.5 py-1 cursor-pointer transition-colors w-14 bg-surface-raised text-muted hover:text-foreground data-active:bg-primary data-active:text-background"
              onclick={() => switchMode(mode as "math" | "draw")}
            >
              {mode}
            </button>
          {/each}
        </div>
        {#if currentMode === "math"}
          <select
            id="preset-select"
            class="font-mono text-xs bg-surface-raised border border-border rounded px-2 py-1 text-foreground cursor-pointer hover:border-primary transition-colors"
            onchange={(e) => {
              const target = e.target as HTMLSelectElement;
              if (target.value && currentMode === "math") {
                loadPreset(target.value);
              }
            }}
          >
            <option value="">Select a curve</option>
            {#each presets as curve}
              <option value={curve.id}>{curve.name}</option>
            {/each}
          </select>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <button
            id="share-btn"
            class="font-mono text-xs px-3 py-1.5 rounded transition-colors text-muted hover:text-foreground hover:bg-surface-raised flex items-center gap-1.5 cursor-pointer"
            onclick={handleShareClick}
          >
            <Share2 class="w-3.5 h-3.5" />
            Share
          </button>
          {#if shareStatus}
            <span
              class="absolute right-0 top-6 whitespace-nowrap font-mono text-[10px] text-muted bg-surface border border-border rounded px-2 py-1 z-10"
            >
              {shareStatus}
            </span>
          {/if}
        </div>
        <button
          class="font-mono text-xs px-3 py-1.5 rounded transition-colors bg-primary text-background hover:bg-error flex items-center gap-1.5 cursor-pointer"
          onclick={handleClear}
        >
          <Trash class="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>

    <div class="flex-1 p-4 overflow-auto">
      {#if currentMode === "math"}
        <div id="editor-section" class="mb-3">
          <label
            for="code-input"
            class="block font-mono text-[10px] tracking-wider text-muted mb-1"
          >
            <span class="text-muted"
              ><span class="text-primary font-semibold">function</span> (<code
                title="parametric angle (0 -> period)"
                class="text-accent">t</code
              ><span class="text-muted">: number, </span><code
                title="elapsed time in seconds"
                class="text-accent">time</code
              ><span class="text-muted">: number, </span><code
                title="custom parameters object"
                class="text-accent">params</code
              ><span class="text-muted"
                >: Record&lt;string, number&gt;) <span
                  class="text-primary font-semibold">{"{"}</span
                ></span
              >
            </span>
          </label>
          <textarea
            id="code-input"
            class="w-full h-36 font-mono text-sm bg-surface-raised border {error
              ? 'border-error'
              : 'border-border'} rounded-md p-3 text-foreground resize-none focus:outline-none focus:border-primary transition-colors"
            bind:value={currentCode}
            oninput={handleCodeChange}>{currentCode}</textarea
          >
          {#if error}
            <div class="mt-1.5 font-mono text-xs text-error">{error}</div>
          {/if}
          <span class="mt-1 font-mono text-[10px] text-primary font-semibold"
            >{"}"}</span
          >
        </div>
      {:else}
        <div id="draw-section" class="mb-3">
          <div
            class="relative w-full max-w-md mx-auto aspect-square bg-white rounded-md border border-border overflow-hidden"
          >
            {#if DrawBoard}
              <DrawBoard
                bind:this={drawBoardRef}
                {canvas}
                {trailLength}
                {speed}
                {trailStyle}
                trailColor={resolvedTrailColor}
                skeletonColor={resolvedSkeletonColor}
                {headColor}
                {headColorAuto}
                initialPoints={drawInitialPoints}
                onCanAnimateChange={(v: boolean) => (drawCanAnimate = v)}
                onAnimateModeChange={(v: boolean) => (drawIsAnimating = v)}
              />
            {:else}
              <div
                class="absolute inset-0 flex items-center justify-center font-mono text-sm text-muted"
              >
                Loading drawing board...
              </div>
            {/if}
          </div>
          {#if DrawBoard}
            <button
              id="animate-btn"
              class="w-full font-mono text-xs px-3 py-2 mt-3 rounded transition-colors bg-primary text-background hover:bg-primary/90 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!drawCanAnimate}
              onclick={() => drawBoardRef?.toggleAnimate()}
            >
              {drawIsAnimating ? "Edit" : "Animate"}
            </button>
            <p class="mt-2 font-mono text-xs text-muted">
              Click on the board to place points. Drag to move. Click a point to
              delete.
            </p>
          {/if}
        </div>
      {/if}

      <div class="space-y-3">
        <button
          id="skeleton-toggle"
          class="flex items-center gap-2 cursor-pointer"
          onclick={handleSkeletonToggle}
        >
          <span class="text-xs font-mono text-muted"
            >{showSkeleton ? "ON" : "OFF"}</span
          >
          <span
            class="relative w-10 h-5 rounded-full transition-colors {showSkeleton
              ? 'bg-foreground'
              : 'bg-border'}"
          >
            <span
              class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform {showSkeleton
                ? 'translate-x-5'
                : 'translate-x-0'}"
            ></span>
          </span>
          <span class="text-xs font-mono text-muted">Skeleton</span>
        </button>

        <div class="flex items-center gap-2">
          <label
            for="speed-slider"
            class="font-mono text-[10px] tracking-wider uppercase text-muted w-24 shrink-0"
            >Speed</label
          >
          <input
            type="range"
            id="speed-slider"
            min="0.1"
            max="5"
            step="0.1"
            bind:value={speed}
            class="flex-1 min-w-0 accent-primary"
            oninput={(e) =>
              handleSpeedChange(
                parseFloat((e.target as HTMLInputElement).value),
              )}
          />
          <span
            class="font-mono text-[10px] text-muted w-7 text-right tabular-nums"
            >{speed.toFixed(1)}</span
          >
        </div>

        <div class="flex items-center gap-2">
          <label
            for="trail-slider"
            class="font-mono text-[10px] tracking-wider uppercase text-muted w-24 shrink-0"
            >Trail Length</label
          >
          <input
            type="range"
            id="trail-slider"
            min="10"
            max="500"
            step="10"
            bind:value={trailLength}
            class="flex-1 min-w-0 accent-primary"
            onchange={(e) =>
              handleTrailLengthChange(
                parseInt((e.target as HTMLInputElement).value),
              )}
          />
          <span
            class="font-mono text-[10px] text-muted w-7 text-right tabular-nums"
            >{trailLength}</span
          >
        </div>

        <div class="border-t border-border-subtle"></div>

        <div class="grid grid-cols-3 gap-x-3">
          <div class="flex flex-col gap-1">
            <label
              for="trail-style-select"
              class="font-mono text-[10px] tracking-wider uppercase text-muted"
              >Trail Style</label
            >
            <select
              id="trail-style-select"
              class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2 py-1 text-foreground cursor-pointer hover:border-primary transition-colors"
              bind:value={trailStyle}
              onchange={() => handleTrailStyleChange(trailStyle as TrailStyle)}
            >
              <option value="default">Default</option>
              <option value="gradient-static">Static Gradient</option>
              <option value="gradient-animated">Animated</option>
            </select>
          </div>

          {#if !showPalette}
            <div id="color-controls" class="contents">
              <div class="flex flex-col gap-1">
                <label
                  for="color-input"
                  class="font-mono text-[10px] tracking-wider uppercase text-muted"
                  >Trail</label
                >
                <input
                  type="color"
                  id="color-input"
                  bind:value={trailColor}
                  class="w-full h-7 cursor-pointer"
                  oninput={(e) =>
                    handleTrailColorChange(
                      (e.target as HTMLInputElement).value,
                    )}
                />
              </div>
              <div class="flex flex-col gap-1">
                <label
                  for="head-color-input"
                  class="font-mono text-[10px] tracking-wider uppercase text-muted"
                  >Head</label
                >
                <div class="flex items-center gap-1.5">
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      id="head-color-auto"
                      bind:checked={headColorAuto}
                      class="accent-primary"
                      onchange={() => handleHeadColorAutoChange(headColorAuto)}
                    />
                    <span class="font-mono text-[10px] text-muted">Auto</span>
                  </label>
                  <div class="w-full rounded-md overflow-hidden">
                    <input
                      type="color"
                      id="head-color-input"
                      bind:value={headColor}
                      class="w-full h-7 cursor-pointer {headColorAuto
                        ? 'opacity-50'
                        : ''}"
                      disabled={headColorAuto}
                      oninput={(e) =>
                        handleHeadColorChange(
                          (e.target as HTMLInputElement).value,
                        )}
                    />
                  </div>
                </div>
              </div>
            </div>
          {/if}

          {#if showPalette}
            <div
              id="palette-container"
              class="col-start-2 col-span-2 flex flex-col gap-1.5"
            >
              <div class="flex items-center justify-between">
                <label
                  for="palette-select"
                  class="font-mono text-[10px] tracking-wider uppercase text-muted"
                  >Palette</label
                >
                <select
                  id="palette-select"
                  class="font-mono text-xs bg-transparent border border-border rounded px-2 py-1 text-foreground cursor-pointer hover:border-primary transition-colors"
                  bind:value={palette}
                  onchange={() => handlePaletteChange(palette)}
                >
                  <option value="bard">Bard</option>
                  <option value="sunset">Sunset</option>
                  <option value="ocean">Ocean</option>
                  <option value="ice">Ice</option>
                  <option value="fire">Fire</option>
                  <option value="forest">Forest</option>
                </select>
              </div>

              <div
                id="palette-preview"
                class="h-2 w-full rounded-full"
                style="background-image: {paletteColors}; background-size: 200% 100%;"
                class:animated={isPaletteAnimated}
              ></div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <section
    class="w-full lg:w-1/2 flex items-center justify-center bg-surface-raised p-4 relative"
  >
    <div
      class="absolute inset-0 bg-[radial-gradient(#d0cec9_1.5px,transparent_1.5px)] bg-size-[24px_24px] opacity-60"
    ></div>
    <div class="relative w-full max-w-md aspect-square">
      <canvas
        bind:this={canvas}
        id="preview-canvas"
        width="400"
        height="400"
        class="w-full h-full"
      ></canvas>
    </div>
  </section>
</div>

<style>
  #palette-preview.animated {
    animation: palette-shift 3s linear infinite;
  }
  @keyframes palette-shift {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 200% 50%;
    }
  }
</style>
