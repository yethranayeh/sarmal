<script lang="ts">
  import type { TrailStyle, SarmalPalette } from "@sarmal/core";
  import type { PlaygroundState } from "./playgroundState.svelte";

  import { getContext, onMount } from "svelte";
  import { palettes } from "@sarmal/core";
  import Link from "../../components/icons/Link.svelte";
  import MoveRight from "../../components/icons/MoveRight.svelte";
  import Unlink from "../../components/icons/Unlink.svelte";
  import XIcon from "../../components/icons/XIcon.svelte";
  import { CodeJar } from "codejar";
  import Prism from "prismjs";
  import "prismjs/components/prism-javascript";

  import Slider from "./Slider.svelte";
  import ToggleSwitch from "./ToggleSwitch.svelte";
  import Tooltip from "./Tooltip.svelte";

  const pg = getContext<PlaygroundState>("playground");

  let codeEditor = $state<HTMLDivElement>();
  let lineGutter = $state<HTMLDivElement>();
  let lineCount = $derived(pg.currentCode.split("\n").length);
  let jar: ReturnType<typeof CodeJar>;
  const hasOutOfRangePoints = $derived(
    pg.drawPoints.some((p) => p[0] < -1 || p[0] > 1 || p[1] < -1 || p[1] > 1),
  );

  function syncScroll() {
    if (lineGutter && codeEditor) {
      lineGutter.scrollTop = codeEditor.scrollTop;
    }
  }

  onMount(() => {
    if (!codeEditor) {
      return;
    }

    function highlight(editor: HTMLElement) {
      const code = editor.textContent ?? "";
      editor.innerHTML = Prism.highlight(
        code,
        Prism.languages.javascript,
        "javascript",
      );
    }

    jar = CodeJar(codeEditor, highlight, {
      tab: "  ",
      addClosing: true,
      spellcheck: false,
    });

    jar.onUpdate((code: string) => {
      pg.currentCode = code;
      pg.handleCodeChange();
    });

    jar.updateCode(pg.currentCode, false);

    return () => jar.destroy();
  });

  $effect(() => {
    const code = pg.currentCode;
    if (jar && jar.toString() !== code) {
      jar.updateCode(code, false);
    }
  });

  function handlePointKeydown(
    e: KeyboardEvent,
    index: number,
    axis: "x" | "y",
  ) {
    const target = e.target as HTMLInputElement;
    let step = 0.01;

    if (e.shiftKey) {
      step = 0.1;
    } else if (e.altKey) {
      step = 0.001;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const current = target.value === "" ? 0 : parseFloat(target.value);
      if (isNaN(current)) {
        return;
      }

      const next = current + step;
      target.value = next.toFixed(3);
      pg.handleDrawPointChange(index, axis, next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const current = target.value === "" ? 0 : parseFloat(target.value);
      if (isNaN(current)) {
        return;
      }

      const next = current - step;
      target.value = next.toFixed(3);
      pg.handleDrawPointChange(index, axis, next);
    }
  }
</script>

<aside
  class="absolute lg:relative inset-y-0 left-0 z-30 w-[min(85vw,360px)] lg:w-90 lg:shrink-0 p-3 lg:border-r border-border bg-background overflow-y-auto flex flex-col transition-transform duration-300 {pg.sidebarVisible
    ? 'translate-x-0'
    : '-translate-x-full'} lg:translate-x-0"
>
  <!-- Mobile close header -->
  <div class="flex items-center justify-between mb-1 lg:hidden">
    <span class="font-heading text-xs font-medium text-muted-foreground"
      >Controls</span
    >
    <button
      class="p-1 rounded cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
      onclick={() => (pg.sidebarVisible = false)}
      aria-label="Close controls"
    >
      <XIcon class="w-4 h-4" />
    </button>
  </div>

  <!-- Definition -->
  <section class="pb-4 border-b border-border-subtle">
    <header class="flex items-baseline justify-between gap-3 whitespace-nowrap">
      <h2 class="font-heading text-[13px] font-medium text-foreground m-0">
        {pg.currentMode === "math" ? "Definition" : "Control points"}
      </h2>
      {#if pg.currentMode === "draw" && pg.drawPointCount > 0}
        <ToggleSwitch
          label={pg.showDrawControls ? "Visible" : "Hidden"}
          checked={pg.shouldShowDrawControls}
          onChange={(v) => (pg.showDrawControls = v)}
        />
      {/if}
    </header>

    {#if pg.currentMode === "draw" && hasOutOfRangePoints}
      <p class="font-ui italic text-xs leading-normal text-warning mt-2">
        Some points are outside the <code>[-1, 1]</code> range. They will
        <strong>still render correctly</strong>. The bounding box is a reference
        frame, not a hard limit.
      </p>
    {/if}

    {#if pg.currentMode === "math"}
      <div class="flex flex-col gap-3">
        <select
          class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2.5 py-2 text-foreground cursor-pointer hover:border-primary transition-colors bg-no-repeat bg-right bg-size-[14px] pr-8"
          value={pg.presetId}
          onchange={(e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) pg.loadPreset(target.value);
          }}
        >
          <option value="">Select a curve</option>
          {#each pg.presets as curve}
            <option value={curve.id}>{curve.name}</option>
          {/each}
        </select>

        {#if pg.codeWasMigrated}
          <div
            class="font-ui italic text-xs leading-normal text-warning space-y-1"
          >
            <p>This code was automatically updated from an older format:</p>
            <div>
              <div class="flex items-center gap-1">
                <code class="line-through">t</code><MoveRight
                  class="inline size-4"
                /><code class="font-semibold">phase</code>
              </div>
              <div class="flex items-center gap-1">
                <code class="line-through">time</code><MoveRight
                  class="inline size-4"
                /><code class="font-semibold">elapsed</code>
              </div>
            </div>
            <p>
              Any variable names that clashed were renamed with a <code
                class="font-semibold">legacy_</code
              > prefix.
            </p>
          </div>
        {/if}

        <p
          class="font-heading italic text-xs leading-relaxed text-muted-foreground lg:hidden"
        >
          <span class="font-mono font-bold not-italic text-[11px] text-primary"
            >phase:</span
          >
          {" "}position along curve (0 to period),
          {" "}
          <span class="font-mono font-bold not-italic text-[11px] text-primary"
            >elapsed:</span
          >
          {" "}elapsed seconds
        </p>

        <div
          class="bg-surface-raised border {pg.error
            ? 'border-error'
            : 'border-border'} rounded transition-colors focus-within:border-primary overflow-hidden"
        >
          <div
            class="flex items-center gap-1.5 px-3 py-2 border-b border-border-subtle bg-surface font-mono text-[10.5px]"
          >
            <span class="text-primary font-semibold font-mono">function</span>
            <span class="text-muted-gray">(</span>
            <Tooltip placement="bottom" class="-translate-x-1/4">
              {#snippet tooltip()}
                <div class="space-y-1 min-w-40">
                  <p class="whitespace-normal">
                    <span class="font-mono text-primary">phase:</span> position along
                    curve
                  </p>
                  <p>
                    <span class="font-mono text-primary">elapsed:</span> elapsed seconds
                  </p>
                </div>
              {/snippet}
              <span
                class="text-muted-foreground italic font-heading text-xs cursor-help"
              >
                phase, elapsed
              </span>
            </Tooltip>
            <span class="text-muted-gray">)</span>
            <span class="text-primary font-bold font-mono text-[11px]"
              >{`{`}</span
            >
          </div>
          <div class="flex min-h-35">
            <div
              bind:this={lineGutter}
              class="shrink-0 w-8 pt-2.5 pb-2.5 font-mono text-xs leading-[1.55] text-right select-none overflow-hidden border-r border-border-subtle text-muted-gray/45"
              aria-hidden="true"
            >
              {#each { length: Math.max(lineCount, 1) } as _, i}
                <div class="pr-2" style="font-variant-numeric: tabular-nums;">
                  {i + 1}
                </div>
              {/each}
            </div>
            <div
              bind:this={codeEditor}
              onscroll={syncScroll}
              class="w-full py-2.5 pr-3 pl-2 font-mono text-xs leading-[1.55] text-foreground bg-transparent resize-none outline-none block [&_.token.keyword]:text-primary [&_.token.function]:text-[#2563eb] [&_.token.string]:text-[#059669] [&_.token.number]:text-[#d97706] [&_.token.comment]:text-muted-gray [&_.token.operator]:text-muted-gray [&_.token.punctuation]:text-muted-gray [&_.token.builtin]:text-[#7c3aed] [&_.token.boolean]:text-primary [&_.token.class-name]:text-[#2563eb]"
            ></div>
          </div>
          <div
            class="px-3 py-1 font-bold font-mono text-[11px] bg-surface text-primary"
          >
            {`}`}
          </div>
        </div>
        {#if pg.error}
          <div class="font-mono text-xs text-error">{pg.error}</div>
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
              class="pl-1 font-mono font-bold not-italic text-[11px] text-primary"
              >phase</span
            >.
          </p>
        {/if}
      </div>
    {:else if pg.drawPoints.length > 0}
      {#snippet pointInput(
        index: number,
        axis: "x" | "y",
        point: [number, number],
      )}
        {@const coord = axis === "x" ? 0 : 1}
        {@const isOutOfRange = point[coord] < -1 || point[coord] > 1}
        <label class="flex items-center gap-1 cursor-text">
          <span class="text-muted-gray">{axis}</span>
          <input
            type="number"
            step="any"
            value={point[coord]}
            class="w-full min-w-0 bg-transparent border-0 p-0 font-mono text-[11px] text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none border-b border-muted/50 focus:border-muted"
            class:text-warning={isOutOfRange}
            oninput={(e) => {
              const v = parseFloat((e.target as HTMLInputElement).value);

              if (!isNaN(v)) {
                pg.handleDrawPointChange(index, axis, v);
              }
            }}
            onkeydown={(e) => handlePointKeydown(e, index, axis)}
            aria-label="Point {index + 1} {axis}"
          />
        </label>
      {/snippet}

      <div
        class="bg-surface-raised border border-border rounded-md overflow-hidden mt-4 max-h-56 overflow-y-auto"
      >
        {#each pg.drawPoints as point, i}
          <div
            class="grid grid-cols-[26px_1fr_1fr_24px] items-center px-2.5 py-2 font-mono text-[11px] text-muted-foreground {i <
            pg.drawPoints.length - 1
              ? 'border-b border-border-subtle'
              : ''}"
          >
            <span class="text-accent">{String(i + 1).padStart(2, "0")}</span>
            {@render pointInput(i, "x", point)}
            {@render pointInput(i, "y", point)}
            <button
              class="cursor-pointer w-max rounded-full p-1 hover:bg-primary/10 transition-colors"
              onclick={() => pg.drawBoardRef?.deletePointAt(i)}
              aria-label="Delete point {i + 1}"
            >
              <XIcon size={14} class="text-primary" />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Shape -->
  <section class="py-4 border-b border-border-subtle flex flex-col gap-4">
    <header class="flex items-baseline justify-between gap-3 whitespace-nowrap">
      <h2 class="font-heading text-[13px] font-medium text-foreground m-0">
        Shape
      </h2>
    </header>

    <ToggleSwitch
      label="Skeleton overlay"
      checked={pg.showSkeleton}
      onChange={pg.handleSkeletonToggle}
    />

    <Slider
      label="Speed"
      value={pg.speed}
      min={0.1}
      max={5}
      step={0.05}
      formatValue={(v) => `${v.toFixed(2)}×`}
      onChange={pg.handleSpeedChange}
    />

    <Slider
      label="Trail length"
      value={pg.trailLength}
      min={10}
      max={500}
      step={1}
      formatValue={(v) => Math.round(v).toString()}
      onChange={pg.handleTrailLengthChange}
      onCommit={pg.handleTrailLengthCommit}
    />

    <Slider
      label="Head radius"
      value={pg.headRadius ?? 0.5}
      min={0.1}
      max={1}
      step={0.1}
      formatValue={(v) => v.toFixed(1)}
      onChange={pg.handleHeadRadiusChange}
    />
  </section>

  <!-- Style -->
  <section class="pt-4 flex flex-col gap-4">
    <header class="flex items-baseline justify-between gap-3 whitespace-nowrap">
      <h2 class="font-heading text-[13px] font-medium text-foreground m-0">
        Style
      </h2>
    </header>

    <div class="flex flex-col gap-2">
      <span
        class="font-ui text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
        >Trail style</span
      >
      <select
        class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2.5 py-2 text-foreground cursor-pointer hover:border-primary transition-colors bg-no-repeat pr-8"
        bind:value={pg.trailStyle}
        onchange={() => pg.handleTrailStyleChange(pg.trailStyle as TrailStyle)}
      >
        <option value="default">Default</option>
        <option value="gradient-static">Static Gradient</option>
        <option value="gradient-animated">Animated</option>
      </select>
    </div>

    {#if !pg.showPalette}
      <div class="flex gap-3">
        <!-- Trail swatch -->
        <div class="flex-1 flex flex-col gap-1.5">
          <span
            class="font-ui text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
            >Trail</span
          >
          <div
            class="relative h-7.5 rounded border border-border overflow-hidden cursor-pointer"
            style="background: {pg.trailColor}"
          >
            <input
              type="color"
              bind:value={pg.trailColor}
              oninput={(e) =>
                pg.handleTrailColorChange((e.target as HTMLInputElement).value)}
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span class="font-mono text-[10px] text-muted-gray uppercase"
            >{pg.trailColor.toUpperCase()}</span
          >
        </div>

        <!-- Link toggle -->
        <div class="flex flex-col justify-center">
          <button
            class="p-1.5 rounded cursor-pointer transition-colors {pg.headColorAuto
              ? 'text-primary bg-primary/10'
              : 'text-muted-gray hover:text-foreground hover:bg-surface-raised'}"
            onclick={() => pg.handleHeadColorAutoChange(!pg.headColorAuto)}
            title={pg.headColorAuto
              ? "Head color linked to trail"
              : "Head color unlinked"}
          >
            {#if pg.headColorAuto}
              <Link class="w-4 h-4" />
            {:else}
              <Unlink class="w-4 h-4" />
            {/if}
          </button>
        </div>

        <!-- Head swatch -->
        <div class="flex-1 flex flex-col gap-1.5">
          <span
            class="font-ui text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
            >Head</span
          >
          <div
            class="relative h-7.5 rounded border border-border overflow-hidden {pg.headColorAuto
              ? 'cursor-not-allowed'
              : 'cursor-pointer'}"
            style="background-color: {pg.headColor}"
          >
            {#if !pg.headColorAuto}
              <input
                type="color"
                bind:value={pg.headColor}
                oninput={(e) =>
                  pg.handleHeadColorChange(
                    (e.target as HTMLInputElement).value,
                  )}
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            {/if}
          </div>
          <span class="font-mono text-[10px] text-muted-gray uppercase"
            >{pg.headColor.toUpperCase()}</span
          >
        </div>
      </div>
    {:else}
      <div class="flex flex-col gap-2">
        <span
          class="font-ui text-[10px] font-medium tracking-[0.12em] uppercase text-muted-gray"
          >Palette</span
        >
        <select
          class="w-full font-mono text-xs bg-surface-raised border border-border rounded px-2.5 py-2 text-foreground cursor-pointer hover:border-primary transition-colors pr-8"
          bind:value={pg.palette}
          onchange={() => pg.handlePaletteChange(pg.palette as SarmalPalette)}
        >
          {#each Object.keys(palettes) as paletteName}
            <option value={paletteName}>{paletteName}</option>
          {/each}
        </select>
        <div
          class="h-2 w-full rounded-full mt-1"
          style="background-image: {pg.paletteColors}; background-size: 200% 100%;"
          class:animated={pg.isPaletteAnimated}
        ></div>
      </div>
    {/if}
  </section>
</aside>

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
