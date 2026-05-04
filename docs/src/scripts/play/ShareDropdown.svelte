<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type { SharedState } from "./types";

  import { getContext, onMount } from "svelte";
  import {
    Share2,
    ImageDown,
    Braces,
    ChevronDown,
    Code,
    FileCode,
    Film,
    Share,
  } from "@lucide/svelte";

  import {
    generateJSSnippet,
    generateReactSnippet,
    generateStandaloneHTML,
    downloadPNG,
    downloadSVG,
    generateSVGString,
    copyToClipboard,
  } from "./export/index";
  import { handleShare } from "./share";

  import Button from "../../components/Button.svelte";
  import WebMExportDialog from "./WebMExportDialog.svelte";

  const pg = getContext<PlaygroundState>("playground");

  let open = $state(false);
  let status = $state<string | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | null = null;

  function showStatus(msg: string, duration = 3000) {
    status = msg;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status = null;
    }, duration);
  }

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  function handleClickOutside() {
    if (open) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      close();
    }
  }

  const codeDisabled = $derived(
    (pg.currentMode === "math" && !pg.lastCompiledFn) ||
      (pg.currentMode === "draw" && pg.drawPointCount < 3),
  );

  const pngDisabled = $derived(
    !pg.previewRef.current ||
      (pg.currentMode === "draw" ? pg.drawPointCount < 3 : !pg.instance),
  );

  const svgDisabled = $derived(
    pg.currentMode === "draw" ? pg.drawPointCount < 3 : !pg.instance,
  );

  const webmSupported = $derived(typeof MediaRecorder !== "undefined");

  const webmDisabled = $derived(
    pg.currentMode === "draw" ? pg.drawPointCount < 3 : !pg.lastCompiledFn,
  );

  async function handleShareURL() {
    if (codeDisabled) {
      return;
    }

    const payload: SharedState = {
      v: 2,
      mode: pg.currentMode,
      code: pg.currentMode === "draw" ? "" : pg.currentCode,
      trailStyle: pg.trailStyle,
      palette: pg.palette,
      trailColor: pg.trailColor,
      headColor: pg.headColor,
      headColorAuto: pg.headColorAuto,
      ...(pg.headRadius !== null ? { headRadius: pg.headRadius } : {}),
      trailLength: pg.trailLength,
      speed: pg.speed,
      showSkeleton: pg.showSkeleton,
    };

    if (pg.currentMode === "draw") {
      payload.drawPoints = pg.drawBoardRef?.getPoints();
    }

    const c = pg.previewRef.current;
    if (!c) return;

    const result = await handleShare(c, payload);
    if (result.ok) {
      showStatus("Link copied. Expires in 90 days.");
    } else {
      showStatus(result.error, 4000);
    }
  }

  async function handleCopyCode() {
    try {
      const snippet = generateJSSnippet(pg);
      const ok = await copyToClipboard(snippet);
      showStatus(ok ? "Copied" : "Clipboard access denied", ok ? 2000 : 4000);
    } catch {
      showStatus("Failed to generate snippet", 4000);
    }
  }

  async function handleCopyHTML() {
    try {
      const html = generateStandaloneHTML(pg);
      const ok = await copyToClipboard(html);
      showStatus(ok ? "Copied" : "Clipboard access denied", ok ? 2000 : 4000);
    } catch {
      showStatus("Failed to generate HTML", 4000);
    }
  }

  async function handleCopyReact() {
    try {
      const snippet = generateReactSnippet(pg);
      const ok = await copyToClipboard(snippet);
      showStatus(ok ? "Copied" : "Clipboard access denied", ok ? 2000 : 4000);
    } catch {
      showStatus("Failed to generate snippet", 4000);
    }
  }

  async function handleDownloadPNG() {
    const c = pg.previewRef.current;
    if (!c) return;
    try {
      await downloadPNG(c);
      showStatus("Downloaded");
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Failed to download",
        4000,
      );
    }
  }

  function handleDownloadSVG() {
    try {
      downloadSVG(pg);
      showStatus("Downloaded");
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Failed to download SVG",
        4000,
      );
    }
  }

  let webmDialog: WebMExportDialog | null = $state(null);

  function handleExportWebM() {
    close();
    webmDialog?.open();
  }

  async function handleCopySVG() {
    try {
      const svgString = generateSVGString(pg);
      const ok = await copyToClipboard(svgString);
      showStatus(ok ? "Copied" : "Clipboard access denied", ok ? 2000 : 4000);
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Failed to copy SVG",
        4000,
      );
    }
  }

  onMount(() => {
    return () => {
      if (statusTimer) clearTimeout(statusTimer);
    };
  });
</script>

<div class="relative">
  <Button
    variant="ghost"
    onclick={toggle}
    aria-expanded={open}
    aria-haspopup="menu"
  >
    {#snippet icon()}<Share class="size-4" />{/snippet}
    Export
    <span
      class="transition-transform duration-150 ml-0.5"
      class:rotate-180={open}
    >
      <ChevronDown class="size-3.5" />
    </span>
  </Button>

  {#if status}
    <span
      class="absolute right-0 top-9 whitespace-nowrap font-ui text-[10px] text-muted bg-surface-raised border border-border rounded px-2 py-1 shadow-[0_2px_8px_color-mix(in_srgb,var(--color-foreground)_6%,transparent)] z-30"
    >
      {status}
    </span>
  {/if}

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-10"
      onclick={handleClickOutside}
      role="presentation"
    ></div>

    <div
      class="absolute right-0 bottom-full mb-1 z-20 bg-surface-raised/95 backdrop-blur-md border border-border rounded-lg shadow-[0_4px_16px_color-mix(in_srgb,var(--color-foreground)_8%,transparent)] min-w-52.5 py-1 origin-bottom-right select-none [&_svg]:size-4 [&_svg]:shrink-0 md:top-full md:bottom-auto md:mt-1 md:mb-0 md:origin-top-right"
      class:animate-scale-in={open}
      role="menu"
    >
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={codeDisabled}
        onclick={() => {
          close();
          handleCopyCode();
        }}
      >
        <Code class="size-4" />
        Copy as code
      </button>
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={codeDisabled}
        onclick={() => {
          close();
          handleShareURL();
        }}
      >
        <Share2 class="size-4" />
        Create shareable URL
      </button>
      <div class="bg-border h-px mx-1 my-1" role="separator"></div>
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={pngDisabled}
        onclick={() => {
          close();
          handleDownloadPNG();
        }}
      >
        <ImageDown class="size-4" />
        Download PNG
      </button>
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={codeDisabled}
        onclick={() => {
          close();
          handleCopyHTML();
        }}
      >
        <FileCode class="size-4" />
        Copy as HTML
      </button>
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={codeDisabled}
        onclick={() => {
          close();
          handleCopyReact();
        }}
      >
        <Braces class="size-4" />
        Copy as React
      </button>
      {#if webmSupported}
        <button
          class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          role="menuitem"
          disabled={webmDisabled}
          onclick={handleExportWebM}
        >
          <Film class="size-4" />
          Export as WebM
        </button>
      {/if}
      <div class="bg-border h-px mx-1 my-1" role="separator"></div>
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={svgDisabled}
        onclick={() => {
          close();
          handleDownloadSVG();
        }}
      >
        <FileCode class="size-4" />
        Download SVG
      </button>
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={svgDisabled}
        onclick={() => {
          close();
          handleCopySVG();
        }}
      >
        <FileCode class="size-4" />
        Copy as SVG
      </button>
    </div>
  {/if}
</div>

<WebMExportDialog bind:this={webmDialog} />

<svelte:window onkeydown={handleKeydown} />

<style>
  @media (prefers-reduced-motion: no-preference) {
    .animate-scale-in {
      animation: scale-in 150ms ease-out forwards;
    }
  }

  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
