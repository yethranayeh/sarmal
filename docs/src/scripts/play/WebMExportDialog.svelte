<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import { getContext } from "svelte";

  import Button from "../../components/Button.svelte";
  import {
    recordWebM,
    getWebMDurationSeconds,
    getWebMRawDurationSeconds,
  } from "./export";

  const pg = getContext<PlaygroundState>("playground");

  type DialogMode = "configure" | "rendering" | "ready";

  let dialogEl = $state<HTMLDialogElement | null>(null);
  let mode = $state<DialogMode>("configure");
  let durationMode = $state<"period" | "custom">("period");
  let customDuration = $state(4);
  let renderRatio = $state(0);
  let blob = $state<Blob | null>(null);
  let blobSize = $state("");
  let abortController = $state<AbortController | null>(null);

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

  export function open() {
    mode = "configure";
    durationMode = "period";
    customDuration = 4;
    renderRatio = 0;
    blob = null;
    blobSize = "";
    abortController = null;
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
    class="bg-surface border border-border rounded-lg w-[min(90vw,380px)] mx-auto my-auto p-6 shadow-xl"
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
        <div class="flex gap-2 mb-3">
          <Button
            variant={durationMode === "period" ? "primary" : "ghost"}
            onclick={() => (durationMode = "period")}
          >
            One period
          </Button>
          <Button
            variant={durationMode === "custom" ? "primary" : "ghost"}
            onclick={() => (durationMode = "custom")}
          >
            Custom
          </Button>
        </div>

        {#if durationMode === "period"}
          {@const raw = getWebMRawDurationSeconds(pg)}
          {@const clamped = getWebMDurationSeconds(pg)}
          <p class="font-body text-xs text-muted-foreground">
            ~{raw.toFixed(1)}s{raw > 8
              ? ` (limited to ${clamped.toFixed(1)}s)`
              : ""}
          </p>
        {:else}
          <label class="flex items-center gap-2">
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
        <Button variant="primary" onclick={handleExport}>Export</Button>
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
      <p class="font-body text-xs text-muted-foreground leading-relaxed mb-6">
        {blobSize}
        &#8226;
        {getEffectiveDuration().toFixed(1)}s
      </p>

      <div class="flex justify-end gap-3">
        <Button variant="ghost" onclick={handleCloseReady}>Close</Button>
        <Button variant="primary" onclick={handleDownload}>Download</Button>
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
