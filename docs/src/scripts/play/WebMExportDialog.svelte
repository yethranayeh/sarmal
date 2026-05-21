<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type {
    SarmalInstance,
    DotMatrixRuntimeRenderOptions,
  } from "@sarmal/core";
  import { getContext, tick } from "svelte";

  import Button from "../../components/Button.svelte";
  import Download from "../../components/icons/Download.svelte";
  import Film from "../../components/icons/Film.svelte";
  import PillToggle from "../../components/PillToggle.svelte";
  import {
    recordWebM,
    getWebMDurationSeconds,
    getWebMRawDurationSeconds,
    resolveWebMCurve,
    type WebMRenderer,
  } from "./export/index";
  import { createSarmalDotMatrix } from "@sarmal/core";
  import { SEPARATOR_DOT } from "../../variables";

  const pg = getContext<PlaygroundState>("playground");

  // Fake theatrics so users can appreciate the visuals even on short videos :)
  const MIN_RENDER_MS = 1500;

  type DialogMode = "configure" | "rendering" | "ready";
  type DurationMode = "period" | "custom";
  type DotDensity = "coarse" | "normal" | "fine";

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let mode = $state<DialogMode>("configure");
  let durationMode = $state<DurationMode>("period");
  let customDuration = $state(4);
  let renderRatio = $state(0);
  let blob = $state<Blob | null>(null);
  let blobSize = $state("");
  let abortController = $state<AbortController | null>(null);
  let previewUrl = $state<string | null>(null);

  let rendererMode = $state<WebMRenderer>("standard");
  let dotDensity = $state<DotDensity>("normal");

  let dmCanvasEl = $state<HTMLCanvasElement | null>(null);
  let mirrorInstance: SarmalInstance<DotMatrixRuntimeRenderOptions> | null =
    null;
  let exportStartTime = 0;

  $effect(() => {
    const el = dialogEl;
    if (!el) {
      return;
    }
    const handler = (e: Event) => {
      if (mode === "rendering") {
        e.preventDefault();
      }
    };
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
  });

  $effect(() => {
    const b = blob;
    if (b) {
      const url = URL.createObjectURL(b);
      previewUrl = url;
      return () => URL.revokeObjectURL(url);
    }
    previewUrl = null;
  });

  export function open() {
    mode = "configure";
    durationMode = "period";
    customDuration = 4;
    renderRatio = 0;
    blob = null;
    blobSize = "";
    abortController = null;
    previewUrl = null;
    rendererMode = "standard";
    dotDensity = "normal";
    dialogEl?.showModal();
  }

  function getEffectiveDuration(): number {
    if (durationMode === "custom") {
      return customDuration;
    }

    return getWebMDurationSeconds(pg);
  }

  function clampCustomDuration(v: number): number {
    return Math.max(1, Math.min(8, Math.round(v)));
  }

  function handleBackdropClick(e: MouseEvent) {
    if (mode === "rendering") {
      return;
    }

    if (dialogEl && e.target === dialogEl) {
      dialogEl.close();
    }
  }

  function handleCancelConfigure() {
    dialogEl?.close();
  }

  function handleCancelRendering() {
    abortController?.abort();
    cleanupMirror();
    mode = "configure";
  }

  function handleCloseReady() {
    dialogEl?.close();
  }

  function handleDownload() {
    if (!blob) {
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sarmal.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getDotGrid(): { cols: number; rows: number } {
    if (dotDensity === "coarse") return { cols: 16, rows: 16 };
    if (dotDensity === "fine") return { cols: 48, rows: 48 };
    return { cols: 32, rows: 32 };
  }

  function cleanupMirror() {
    mirrorInstance?.destroy();
    mirrorInstance = null;
  }

  function setupDotMatrix() {
    if (!dmCanvasEl) {
      return;
    }

    mirrorInstance = createSarmalDotMatrix(dmCanvasEl, resolveWebMCurve(pg), {
      cols: 48,
      rows: 27,
      trailColor: pg.headColor,
    });
  }

  async function handleExport() {
    const duration = getEffectiveDuration();
    const { cols, rows } = getDotGrid();
    mode = "rendering";
    renderRatio = 0;
    exportStartTime = performance.now();

    const controller = new AbortController();
    abortController = controller;

    try {
      await tick();
      setupDotMatrix();

      blob = await recordWebM(
        pg,
        duration,
        controller.signal,
        (ratio) => {
          renderRatio = ratio;
        },
        rendererMode,
        cols,
        rows,
      );

      const elapsed = performance.now() - exportStartTime;
      if (elapsed < MIN_RENDER_MS) {
        await new Promise((r) => setTimeout(r, MIN_RENDER_MS - elapsed));
      }

      if (controller.signal.aborted) {
        return;
      }

      cleanupMirror();

      const sizeMB = blob.size / (1024 * 1024);
      blobSize =
        sizeMB < 1
          ? `${Math.round(blob.size / 1024)} KB`
          : `${sizeMB.toFixed(1)} MB`;

      mode = "ready";
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        cleanupMirror();
        return;
      }

      cleanupMirror();
      mode = "configure";
    } finally {
      abortController = null;
    }
  }
</script>

<dialog
  bind:this={dialogEl}
  class="webm-dialog backdrop:bg-foreground/40 backdrop:backdrop-blur-sm bg-transparent p-0 max-w-none w-full my-auto outline-none rounded-lg"
  onclick={handleBackdropClick}
>
  <div
    class="bg-surface border border-border rounded-lg w-[min(90vw,400px)] mx-auto my-auto p-6 shadow-xl"
  >
    {#if mode === "configure"}
      <h3 class="font-heading text-lg font-medium text-foreground mb-2">
        Export as WebM
      </h3>
      <p class="font-body text-xs text-muted-foreground leading-relaxed mb-4">
        Export uses the canvas renderer and may differ slightly from the
        preview.
      </p>

      <div class="mb-4">
        <p class="font-body text-xs text-muted-foreground mb-2">Renderer</p>
        <PillToggle
          options={[
            { value: "standard", label: "Standard" },
            { value: "dotmatrix", label: "Dot Matrix" },
          ]}
          value={rendererMode}
          onchange={(v) => (rendererMode = v)}
        />

        {#if rendererMode === "standard"}
          <p
            class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
          >
            Classic canvas rendering with smooth gradient trails and a glowing
            head dot.
          </p>
        {:else}
          <p
            class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
          >
            Renders the curve as a grid of dots that illuminate along the path.
          </p>

          <div class="mt-4">
            <p class="font-body text-xs text-muted-foreground mb-2">
              Grid Density
            </p>
            <PillToggle
              options={[
                { value: "coarse", label: "Coarse" },
                { value: "normal", label: "Normal" },
                { value: "fine", label: "Fine" },
              ]}
              value={dotDensity}
              onchange={(v) => (dotDensity = v)}
            />

            {#if dotDensity === "coarse"}
              <p
                class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
              >
                Sparse 16x16 grid with bold, chunky dots. Retro feel; smaller
                file size.
              </p>
            {:else if dotDensity === "normal"}
              <p
                class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
              >
                Balanced 32x32 grid. Good detail and performance for most
                exports.
              </p>
            {:else}
              <p
                class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
              >
                Dense 48x48 grid with maximum detail. Smoother dot patterns;
                larger file size.
              </p>
            {/if}
          </div>
        {/if}
      </div>

      <div class="mb-6">
        <p class="font-body text-xs text-muted-foreground mb-2">Duration</p>
        <PillToggle
          options={[
            { value: "period", label: "One Period" },
            { value: "custom", label: "Custom" },
          ]}
          value={durationMode}
          onchange={(v) => (durationMode = v)}
        />

        {#if durationMode === "period"}
          {@const raw = getWebMRawDurationSeconds(pg)}
          {@const clamped = getWebMDurationSeconds(pg)}
          <p
            class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
          >
            Records one full loop of the curve
            <span class="text-accent">(~{raw.toFixed(1)}s)</span>. Period
            <span class="text-accent">&divide;</span> speed. The period defaults
            to 2&pi; for custom curves. You can choose a preset with a declared
            period for a different duration.
            {#if raw > 8}
              <br />Limited to
              <span class="text-foreground/70">{clamped.toFixed(1)}s</span> (max 8s
              cap).
            {/if}
          </p>
        {:else}
          <p
            class="font-body text-xs text-muted-foreground mt-3 leading-relaxed"
          >
            Choose any duration between 1 and 8 seconds. Shorter exports produce
            smaller files.
          </p>
          <label class="flex items-center gap-2 mt-2">
            <span class="font-body text-xs text-muted-foreground">Seconds:</span
            >
            <input
              type="number"
              min="1"
              max="8"
              step="1"
              value={customDuration}
              oninput={(e) => {
                customDuration = clampCustomDuration(
                  Number((e.target as HTMLInputElement).value),
                );
              }}
              class="w-16 font-mono text-xs bg-surface-raised border border-border rounded px-2 py-1 text-foreground outline-none focus:border-primary"
            />
          </label>
        {/if}
      </div>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={handleCancelConfigure}>Cancel</Button>
        <Button variant="primary" onclick={handleExport}>
          {#snippet icon()}<Film class="w-3.5 h-3.5" />{/snippet}
          Export
        </Button>
      </div>
    {:else if mode === "rendering"}
      <h3 class="font-heading text-lg font-medium text-foreground mb-2">
        Rendering&hellip;
      </h3>

      <div class="mb-4">
        <div
          class="aspect-video bg-surface-raised dark:bg-surface rounded-md overflow-hidden relative border border-border"
        >
          <canvas
            bind:this={dmCanvasEl}
            width="384"
            height="216"
            class="absolute inset-0 w-full h-full"
          ></canvas>
        </div>
      </div>

      <div class="mb-2">
        <div class="h-1.5 bg-surface-raised rounded-full overflow-hidden">
          <div
            class="h-full bg-primary rounded-full transition-[width] duration-100 ease-linear"
            style="width: {Math.round(renderRatio * 100)}%"
          ></div>
        </div>
      </div>
      <p class="font-body text-xs text-muted-foreground mb-6">
        {Math.round(renderRatio * 100)}%
      </p>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={handleCancelRendering}>Cancel</Button>
      </div>
    {:else if mode === "ready"}
      <h3 class="font-heading text-lg font-medium text-foreground mb-2">
        Ready
      </h3>

      {#if previewUrl}
        <video
          src={previewUrl}
          controls
          autoplay
          loop
          muted
          class="w-full rounded-md mb-4 bg-surface-raised"
        ></video>
      {/if}

      <p class="font-body text-xs text-muted-foreground leading-relaxed mb-6">
        {blobSize}
        <span class="text-accent">{SEPARATOR_DOT}</span>
        {getEffectiveDuration().toFixed(1)}s
      </p>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={handleCloseReady}>Close</Button>
        <Button variant="primary" onclick={handleDownload}>
          {#snippet icon()}<Download class="w-3.5 h-3.5" />{/snippet}
          Download
        </Button>
      </div>
    {/if}
  </div>
</dialog>

<style>
  @starting-style {
    dialog[open].webm-dialog > div {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog[open].webm-dialog > div {
      transition:
        opacity 200ms ease-out,
        transform 200ms ease-out;
    }
  }
</style>
