<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type { SharedState } from "./types";

  import { getContext } from "svelte";
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

  type ItemResult = { status: "success" | "error"; label: string } | null;
  let itemResult = $state<Record<string, ItemResult>>({});

  function showItemResult(
    key: string,
    status: "success" | "error",
    label: string,
  ) {
    itemResult[key] = { status, label };

    setTimeout(() => {
      itemResult[key] = null;
    }, 2000);
  }

  function itemClass(key: string): string {
    const f = itemResult[key];
    const base =
      "w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-body transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
    if (f?.status === "success") return `${base} bg-success/10 text-success`;
    if (f?.status === "error") return `${base} bg-error/10 text-error`;
    return `${base} hover:bg-surface`;
  }

  async function handleShareURL() {
    if (codeDisabled) return;

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
      showItemResult("share", "success", "Link copied");
    } else {
      showItemResult("share", "error", "Failed");
    }
  }

  async function handleCopyCode() {
    try {
      const snippet = generateJSSnippet(pg);
      const ok = await copyToClipboard(snippet);
      showItemResult(
        "copyCode",
        ok ? "success" : "error",
        ok ? "Copied" : "Clipboard denied",
      );
    } catch {
      showItemResult("copyCode", "error", "Failed");
    }
  }

  async function handleCopyHTML() {
    try {
      const html = generateStandaloneHTML(pg);
      const ok = await copyToClipboard(html);
      showItemResult(
        "copyHTML",
        ok ? "success" : "error",
        ok ? "Copied" : "Clipboard denied",
      );
    } catch {
      showItemResult("copyHTML", "error", "Failed");
    }
  }

  async function handleCopyReact() {
    try {
      const snippet = generateReactSnippet(pg);
      const ok = await copyToClipboard(snippet);
      showItemResult(
        "copyReact",
        ok ? "success" : "error",
        ok ? "Copied" : "Clipboard denied",
      );
    } catch {
      showItemResult("copyReact", "error", "Failed");
    }
  }

  async function handleDownloadPNG() {
    const c = pg.previewRef.current;
    if (!c) return;
    try {
      await downloadPNG(c);
      showItemResult("downloadPNG", "success", "Downloaded");
    } catch (err) {
      showItemResult(
        "downloadPNG",
        "error",
        err instanceof Error ? err.message : "Failed",
      );
    }
  }

  function handleDownloadSVG() {
    try {
      downloadSVG(pg);
      showItemResult("downloadSVG", "success", "Downloaded");
    } catch (err) {
      showItemResult(
        "downloadSVG",
        "error",
        err instanceof Error ? err.message : "Failed",
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
      showItemResult(
        "copySVG",
        ok ? "success" : "error",
        ok ? "Copied" : "Clipboard denied",
      );
    } catch (err) {
      showItemResult(
        "copySVG",
        "error",
        err instanceof Error ? err.message : "Failed",
      );
    }
  }
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
        class={itemClass("copyCode")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleCopyCode}
      >
        <Code class="size-4" />
        {itemResult["copyCode"]?.label ?? "Copy as code"}
      </button>
      <button
        class={itemClass("share")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleShareURL}
      >
        <Share2 class="size-4" />
        {itemResult["share"]?.label ?? "Create shareable URL"}
      </button>
      <div class="bg-border h-px mx-1 my-1" role="separator"></div>
      <button
        class={itemClass("downloadPNG")}
        role="menuitem"
        disabled={pngDisabled}
        onclick={handleDownloadPNG}
      >
        <ImageDown class="size-4" />
        {itemResult["downloadPNG"]?.label ?? "Download PNG"}
      </button>
      <button
        class={itemClass("copyHTML")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleCopyHTML}
      >
        <FileCode class="size-4" />
        {itemResult["copyHTML"]?.label ?? "Copy as HTML"}
      </button>
      <button
        class={itemClass("copyReact")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleCopyReact}
      >
        <Braces class="size-4" />
        {itemResult["copyReact"]?.label ?? "Copy as React"}
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
        class={itemClass("downloadSVG")}
        role="menuitem"
        disabled={svgDisabled}
        onclick={handleDownloadSVG}
      >
        <FileCode class="size-4" />
        {itemResult["downloadSVG"]?.label ?? "Download SVG"}
      </button>
      <button
        class={itemClass("copySVG")}
        role="menuitem"
        disabled={svgDisabled}
        onclick={handleCopySVG}
      >
        <FileCode class="size-4" />
        {itemResult["copySVG"]?.label ?? "Copy as SVG"}
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
