<script lang="ts">
  import type {
    PresetData,
    SharedState,
    CurveFn,
    PlaygroundMode,
    Preset,
    DrawBoardExports,
  } from "./scripts/play/types";
  import type { Point, TrailStyle, SarmalPalette } from "@sarmal/core";
  import type { DrawingSegment } from "./scripts/play/catmull-rom";

  import { onMount } from "svelte";
  import { palettes } from "@sarmal/core";
  import { Share2, Trash2, Link, Unlink, Trash } from "@lucide/svelte";

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
  import Slider from "./scripts/play/Slider.svelte";

  interface Props {
    presets: PresetData[];
    savedState?: SharedState | null;
  }

  let { presets, savedState }: Props = $props();

  // FIXME: `always 'undefined'` warning, even though it is bound with `bind:this={canvas}`
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
  let palette = $state<SarmalPalette>("bard");
  let presetId = $state<string>("");
  let shareStatus = $state<string | null>(null);

  let instance = $state<ReturnType<typeof createInstance> | null>(null);
  let lastCompiledCode = $state("");
  let lastCompiledFn: CurveFn | null = $state(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  let DrawBoard = $state<any>(null);
  let drawBoardRef = $state<DrawBoardExports | null>(null);
  let drawInitialPoints = $state<Array<DrawingSegment> | undefined>(undefined);
  let drawPoints = $state<Array<DrawingSegment>>([]);
  const drawPointCount = $derived(drawPoints.length);
  let showDrawMeta = $state(true);

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

    presetId = curveId;
    const body = extractBody(preset.fn);
    currentCode = body;
    error = null;

    const result = buildCurveFn(body);
    if (result.ok) {
      rebuildInstance(result.fn, preset.period);
      lastCompiledCode = body;
      lastCompiledFn = result.fn;
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
    presetId = "";

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (currentCode === lastCompiledCode) {
        return;
      }

      const result = buildCurveFn(currentCode);
      if (!result.ok) {
        error = result.error;
        return;
      }

      let oldSamples: Point[] | undefined;
      try {
        if (lastCompiledFn) {
          oldSamples = sampleCurveFn(lastCompiledFn);
        }
      } catch {
        // Old function throws at some samples; treat as different
      }

      let newSamples: Point[] | undefined;
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
      presetId = "";

      if (instance) {
        instance.destroy();
        instance = null;
      }
      lastCompiledCode = "";
      lastCompiledFn = null;
    } else {
      drawBoardRef?.clearPoints();
      showDrawMeta = true;
    }
    history.replaceState(null, "", window.location.pathname);
  }

  function switchMode(mode: PlaygroundMode) {
    if (currentMode === mode) {
      return;
    }

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
        lastCompiledCode = currentCode;
        lastCompiledFn = result.fn;
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
  }

  function handleTrailLengthCommit() {
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
        if (p) {
          headColor = p[p.length - 1]!;
        }
      }
    }
  }

  function handlePaletteChange(newPalette: SarmalPalette) {
    palette = newPalette;

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

        if (p) {
          headColor = p[p.length - 1]!;
        }
      }
    }
  }

  async function handleShareClick() {
    if (!currentCode && currentMode === "math") {
      return;
    }
    if (currentMode === "draw" && drawPointCount < 3) {
      return;
    }

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
      drawPoints = [...saved.drawPoints];

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
        lastCompiledCode = saved.code;
        lastCompiledFn = result.fn;
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
      lastCompiledCode = DEFAULT_CODE;
      lastCompiledFn = result.fn;
    }
  });

  const paletteColors = $derived.by(() => {
    const p = palettes[palette];
    if (!p) {
      return trailColor;
    }
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
  <!-- Sidebar -->
  <aside
    class="w-full space-y-4 lg:w-90 lg:shrink-0 p-3 border-b lg:border-b-0 lg:border-r border-border bg-background overflow-y-auto flex flex-col"
  >
    <!-- Definition -->
    <section class="pb-4 border-b border-border-subtle">
      <header
        class="flex items-baseline justify-between gap-3 whitespace-nowrap"
      >
        <h2 class="font-heading text-[13px] font-medium text-foreground m-0">
          {currentMode === "math" ? "Definition" : "Control points"}
        </h2>
        {#if currentMode === "draw" && drawPointCount > 0}
          <button
            class="relative w-8 h-4.5 rounded-full transition-colors duration-150 shrink-0 cursor-pointer {showDrawMeta
              ? 'bg-primary'
              : 'bg-border'}"
            onclick={() => (showDrawMeta = !showDrawMeta)}
            aria-label={showDrawMeta
              ? "Hide control points"
              : "Show control points"}
          >
            <span
              class="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[left] duration-150 {showDrawMeta
                ? 'left-4'
                : 'left-0.5'}"
            ></span>
          </button>
        {/if}
      </header>

      {#if currentMode === "math"}
        <div class="flex flex-col gap-3">
          <select
            class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2.5 py-2 text-foreground cursor-pointer hover:border-primary transition-colors bg-no-repeat bg-right bg-size-[14px] pr-8"
            value={presetId}
            onchange={(e) => {
              const target = e.target as HTMLSelectElement;
              if (target.value) loadPreset(target.value);
            }}
          >
            <option value="">Select a curve</option>
            {#each presets as curve}
              <option value={curve.id}>{curve.name}</option>
            {/each}
          </select>

          <div
            class="bg-surface-raised border {error
              ? 'border-error'
              : 'border-border'} rounded overflow-hidden transition-colors focus-within:border-primary"
          >
            <div
              class="flex items-center gap-1.5 px-3 py-2 border-b border-border-subtle bg-surface font-mono text-[10.5px]"
            >
              <span class="text-primary font-semibold">function</span>
              <span class="text-foreground font-medium">curve</span>
              <span class="text-muted-gray">(</span>
              <!-- TODO: add title or tooltip explanations for parameters -->
              <span class="text-muted-foreground italic font-heading text-xs"
                >t, time, params</span
              >
              <span class="text-muted-gray">) {`{`}</span>
            </div>
            <textarea
              bind:value={currentCode}
              oninput={handleCodeChange}
              spellcheck="false"
              class="w-full px-3 py-2.5 font-mono text-xs leading-[1.55] text-foreground bg-transparent border-0 resize-none outline-none min-h-35 block"
            ></textarea>
            <div
              class="px-3 py-1 font-mono text-[11px] bg-surface text-primary"
            >
              {`}`}
            </div>
          </div>
          {#if error}
            <div class="font-mono text-xs text-error">{error}</div>
          {:else}
            <p
              class="font-heading italic text-xs leading-relaxed text-muted-foreground"
            >
              Return the parametric coordinates <span
                class="font-mono not-italic text-[11px] text-primary"
                >{`{x, y}`}</span
              >
              as a function of
              <span
                class="font-mono font-bold not-italic text-[11px] text-primary"
                >t</span
              >.
            </p>
          {/if}
        </div>
      {:else if drawPoints.length > 0}
        <div
          class="bg-surface-raised border border-border rounded-md overflow-hidden mt-4 max-h-56 overflow-y-auto"
        >
          {#each drawPoints as point, i}
            <div
              class="grid grid-cols-[26px_1fr_1fr_24px] items-center px-2.5 py-2 font-mono text-[11px] text-muted-foreground {i <
              drawPoints.length - 1
                ? 'border-b border-border-subtle'
                : ''}"
            >
              <span class="text-muted-gray"
                >{String(i + 1).padStart(2, "0")}</span
              >
              <span
                ><span class="text-muted-gray">x</span>
                {point[0].toFixed(2)}</span
              >
              <span
                ><span class="text-muted-gray">y</span>
                {point[1].toFixed(2)}</span
              >
              <button
                class="w-2 h-2 rounded-full cursor-pointer hover:opacity-60 transition-opacity"
                style="background: {trailColor}"
                onclick={() => drawBoardRef?.deletePointAt(i)}
                aria-label="Delete point {i + 1}"
              ></button>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- Shape -->
    <section class="pb-4 border-b border-border-subtle flex flex-col gap-4">
      <header
        class="flex items-baseline justify-between gap-3 whitespace-nowrap"
      >
        <h2 class="font-heading text-[13px] font-medium text-foreground m-0">
          Shape
        </h2>
      </header>

      <!-- skeleton toggle -->
      <button
        class="flex items-center justify-between cursor-pointer w-full"
        onclick={handleSkeletonToggle}
      >
        <span
          class="font-body text-[12px] {showSkeleton
            ? 'text-foreground'
            : 'text-muted-gray'}"
        >
          Skeleton overlay
        </span>
        <span
          class="relative w-8 h-4.5 rounded-full transition-colors duration-150 shrink-0 {showSkeleton
            ? 'bg-primary'
            : 'bg-border'}"
        >
          <span
            class="absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-[left] duration-150 {showSkeleton
              ? 'left-4'
              : 'left-0.5'}"
          ></span>
        </span>
      </button>

      <Slider
        label="Speed"
        value={speed}
        min={0.1}
        max={5}
        step={0.05}
        formatValue={(v) => `${v.toFixed(2)}×`}
        onChange={handleSpeedChange}
      />

      <Slider
        label="Trail length"
        value={trailLength}
        min={10}
        max={500}
        step={1}
        formatValue={(v) => Math.round(v).toString()}
        onChange={handleTrailLengthChange}
        onCommit={handleTrailLengthCommit}
      />
    </section>

    <!-- Style -->
    <section class="flex flex-col gap-4">
      <header
        class="flex items-baseline justify-between gap-3 whitespace-nowrap"
      >
        <h2 class="font-heading text-[13px] font-medium text-foreground m-0">
          Style
        </h2>
      </header>

      <div class="flex flex-col gap-2">
        <span
          class="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
          >Trail style</span
        >
        <select
          class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2.5 py-2 text-foreground cursor-pointer hover:border-primary transition-colors bg-no-repeat pr-8"
          bind:value={trailStyle}
          onchange={() => handleTrailStyleChange(trailStyle as TrailStyle)}
        >
          <option value="default">Default</option>
          <option value="gradient-static">Static Gradient</option>
          <option value="gradient-animated">Animated</option>
        </select>
      </div>

      {#if !showPalette}
        <div class="flex gap-3">
          <!-- Trail swatch -->
          <div class="flex-1 flex flex-col gap-1.5">
            <span
              class="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
              >Trail</span
            >
            <div
              class="relative h-7.5 rounded border border-border overflow-hidden cursor-pointer"
              style="background: {trailColor}"
            >
              <input
                type="color"
                bind:value={trailColor}
                oninput={(e) =>
                  handleTrailColorChange((e.target as HTMLInputElement).value)}
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span class="font-mono text-[10px] text-muted-gray uppercase"
              >{trailColor.toUpperCase()}</span
            >
          </div>

          <!-- Link toggle -->
          <div class="flex flex-col justify-center">
            <button
              class="p-1.5 rounded cursor-pointer transition-colors {headColorAuto
                ? 'text-primary bg-primary/10'
                : 'text-muted-gray hover:text-foreground hover:bg-surface-raised'}"
              onclick={() => handleHeadColorAutoChange(!headColorAuto)}
              title={headColorAuto
                ? "Head color linked to trail"
                : "Head color unlinked"}
            >
              {#if headColorAuto}
                <Link class="w-4 h-4" />
              {:else}
                <Unlink class="w-4 h-4" />
              {/if}
            </button>
          </div>

          <!-- Head swatch -->
          <div class="flex-1 flex flex-col gap-1.5">
            <span
              class="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
              >Head</span
            >
            <div
              class="relative h-7.5 rounded border border-border overflow-hidden {headColorAuto
                ? 'cursor-not-allowed'
                : 'cursor-pointer'}"
              style="background-color: {headColor}"
            >
              {#if !headColorAuto}
                <input
                  type="color"
                  bind:value={headColor}
                  oninput={(e) =>
                    handleHeadColorChange((e.target as HTMLInputElement).value)}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              {/if}
            </div>
            <span class="font-mono text-[10px] text-muted-gray uppercase"
              >{headColor.toUpperCase()}</span
            >
          </div>
        </div>
      {:else}
        <div class="flex flex-col gap-2">
          <span
            class="font-mono text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
            >Palette</span
          >
          <select
            class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2.5 py-2 text-foreground cursor-pointer hover:border-primary transition-colors pr-8"
            bind:value={palette}
            onchange={() => handlePaletteChange(palette)}
          >
            {#each Object.keys(palettes) as palette}
              <option value={palette}>{palette}</option>
            {/each}
          </select>
          <div
            class="h-2 w-full rounded-full mt-1"
            style="background-image: {paletteColors}; background-size: 200% 100%;"
            class:animated={isPaletteAnimated}
          ></div>
        </div>
      {/if}
    </section>
  </aside>

  <!-- Canvas -->
  <section class="flex-1 relative bg-surface-raised overflow-hidden">
    <!-- dot grid decoration -->
    <div
      class="absolute inset-0 bg-[radial-gradient(rgba(27,28,26,0.07)_0.8px,transparent_0.8px)] bg-size-[28px_28px] pointer-events-none"
    ></div>

    <!-- Square canvas inset -->
    <div class="absolute inset-0 flex items-center justify-center p-10">
      <div
        class="relative w-full max-w-[min(640px,calc(100vh-137px))] aspect-square"
      >
        <canvas
          bind:this={canvas}
          id="preview-canvas"
          width="640"
          height="640"
          class="absolute inset-0 w-full h-full"
        ></canvas>

        {#if currentMode === "draw" && DrawBoard}
          <DrawBoard
            bind:this={drawBoardRef}
            {trailLength}
            {speed}
            {trailStyle}
            trailColor={resolvedTrailColor}
            skeletonColor={resolvedSkeletonColor}
            {headColor}
            {headColorAuto}
            initialPoints={drawInitialPoints}
            showMeta={showDrawMeta}
            onPointsChange={(pts: Array<DrawingSegment>) => (drawPoints = pts)}
          />
        {/if}

        <!-- Empty draw state -->
        {#if currentMode === "draw" && drawPointCount === 0}
          <div
            class="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div class="text-center max-w-85 px-6">
              <h2
                class="font-heading italic text-[26px] leading-tight font-normal text-muted-dark m-0"
              >
                Begin with a <span class="text-primary">gesture</span>.
              </h2>
              <p
                class="font-mono text-[11px] tracking-[0.04em] leading-[1.6] text-muted-gray mt-3"
              >
                Click to place a point.<br />
                Three or more become a curve.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Floating: mode segmented control (top-left) -->
    <div
      class="absolute top-4 left-4 z-10 inline-flex items-center bg-surface/90 backdrop-blur-md border border-border rounded-full p-0.75 gap-0.5 shadow-[0_1px_2px_rgba(27,28,26,0.04)]"
    >
      {#each ["math", "draw"] as mode}
        <button
          class="px-4 py-1.5 rounded-full font-body text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer transition-colors duration-150 {currentMode ===
          mode
            ? 'bg-primary text-primary-foreground'
            : 'bg-transparent text-muted-foreground hover:text-foreground'}"
          onclick={() => switchMode(mode as "math" | "draw")}
        >
          {mode}
        </button>
      {/each}
    </div>

    <!-- Floating: share / clear (top-right) -->
    <div class="absolute top-4 right-4 z-10 flex items-center gap-2">
      <div class="relative">
        <!-- TODO: use actual Button.astro -->
        <button
          class="font-body text-xs px-3 py-1.5 inline-flex items-center gap-1.5 bg-white border border-border rounded text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          onclick={handleShareClick}
          disabled={currentMode === "draw" && drawPointCount < 3}
        >
          <Share2 class="w-3.5 h-3.5" />
          Share
        </button>
        {#if shareStatus}
          <span
            class="absolute right-0 top-9 whitespace-nowrap font-mono text-[10px] text-muted bg-surface-raised border border-border rounded px-2 py-1 shadow-[0_2px_8px_rgba(27,28,26,0.06)]"
          >
            {shareStatus}
          </span>
        {/if}
      </div>
      <!-- TODO: use actual Button.astro -->
      <button
        class="font-body text-xs px-3 py-1.5 inline-flex items-center gap-1.5 bg-primary text-white rounded hover:bg-primary/80 transition-colors cursor-pointer"
        onclick={handleClear}
      >
        <Trash class="w-3.5 h-3.5" />
        Clear
      </button>
    </div>

    <!-- Mode tag (bottom-left) -->
    <div class="absolute bottom-6 left-6 z-10 pointer-events-none">
      <div
        class="font-heading italic font-medium text-[28px] leading-none tracking-[-0.01em] text-muted-foreground"
      >
        {currentMode === "math" ? "Parametric" : "Hand-drawn"}
      </div>
      <!-- TODO: add live mouse coordinates -->
    </div>
  </section>
</div>

<style>
  .animated {
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
