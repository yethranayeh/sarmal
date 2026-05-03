<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import { getContext } from "svelte";

  import Button from "../../components/Button.svelte";
  import { Download, Film } from "@lucide/svelte";
  import {
    recordWebM,
    getWebMDurationSeconds,
    getWebMRawDurationSeconds,
  } from "./export";
  import { SEPARATOR_DOT } from "../../variables";

  const pg = getContext<PlaygroundState>("playground");

  type DialogMode = "configure" | "rendering" | "ready";
  type DurationMode = "period" | "custom";

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let mode = $state<DialogMode>("configure");
  let durationMode = $state<DurationMode>("period");
  let customDuration = $state(4);
  let renderRatio = $state(0);
  let blob = $state<Blob | null>(null);
  let blobSize = $state("");
  let abortController = $state<AbortController | null>(null);
  let previewUrl = $state<string | null>(null);
  let isSliding = $state(false);

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

  function switchDurationMode(next: DurationMode) {
    if (next === durationMode) return;
    durationMode = next;
    isSliding = true;
    setTimeout(() => {
      isSliding = false;
    }, 450);
  }

  async function handleExport() {
    const duration = getEffectiveDuration();
    mode = "rendering";
    renderRatio = 0;

    const controller = new AbortController();
    abortController = controller;

    try {
      blob = await recordWebM(pg, duration, controller.signal, (ratio) => {
        renderRatio = ratio;
      });

      const sizeMB = blob.size / (1024 * 1024);
      blobSize =
        sizeMB < 1
          ? `${Math.round(blob.size / 1024)} KB`
          : `${sizeMB.toFixed(1)} MB`;

      mode = "ready";
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }

      mode = "configure";
      // Error silently returns to configure
      // TODO: no user feedback yet
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
      <p class="font-body text-xs text-muted-foreground leading-relaxed mb-1">
        Export uses the canvas renderer and may differ slightly from the
        preview.
      </p>

      <div class="mb-6">
        <div
          class="group relative inline-flex items-center bg-surface-raised backdrop-blur-md border border-border rounded-full p-0.75 gap-0.5 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-foreground)_4%,transparent)]"
        >
          <button
            class="px-4 py-1.5 rounded-full font-body text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer transition-colors duration-300 bg-transparent {durationMode ===
            'period'
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => switchDurationMode("period")}
          >
            One&nbsp;Period
          </button>
          <button
            class="px-4 py-1.5 rounded-full font-body text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer transition-colors duration-300 bg-transparent {durationMode ===
            'custom'
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => switchDurationMode("custom")}
          >
            Custom
          </button>
          <div
            class="bg-primary rounded-full absolute -z-1 h-7 {durationMode ===
            'period'
              ? 'left-1 w-27'
              : 'left-[58%] w-20'} {isSliding ? 'is-sliding' : ''}"
            style="transition: left 300ms cubic-bezier(0.34, 1.2, 0.64, 1), width 300ms cubic-bezier(0.34, 1.2, 0.64, 1);"
          ></div>
        </div>

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

    .is-sliding {
      animation: slide 450ms ease-out forwards;
    }
  }

  @keyframes slide {
    0% {
      filter: blur(0px);
      transform: scaleX(1);
    }
    20% {
      filter: blur(1px);
      transform: scaleX(1.03);
    }
    60% {
      filter: blur(0.5px);
      transform: scaleX(0.98);
    }
    100% {
      filter: blur(0px);
      transform: scaleX(1);
    }
  }
</style>
