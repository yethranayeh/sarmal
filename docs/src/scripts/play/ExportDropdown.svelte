<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type { SharedState } from "./types";
  import { SHARE_STATE_VERSION } from "./types";

  import { getContext } from "svelte";
  import Share2 from "../../components/icons/Share2.svelte";
  import ImageDown from "../../components/icons/ImageDown.svelte";
  import ChevronDown from "../../components/icons/ChevronDown.svelte";
  import Code from "../../components/icons/Code.svelte";
  import Film from "../../components/icons/Film.svelte";
  import Share from "../../components/icons/Share.svelte";
  import FileCodeCorner from "../../components/icons/FileCodeCorner.svelte";

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
      v: SHARE_STATE_VERSION,
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
      ...(pg.activePeriod !== Math.PI * 2
        ? { activePeriod: pg.activePeriod }
        : {}),
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
        class={itemClass("copyCode")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleCopyCode}
      >
        <Code class="size-4" />
        {itemResult["copyCode"]?.label ?? "Copy as code"}
      </button>
      <button
        class={itemClass("copyHTML")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleCopyHTML}
      >
        <FileCodeCorner class="size-4" />
        {itemResult["copyHTML"]?.label ?? "Copy as HTML"}
      </button>
      <button
        class={itemClass("copyReact")}
        role="menuitem"
        disabled={codeDisabled}
        onclick={handleCopyReact}
      >
        <svg
          class="size-4"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          ><title>React - simpleicons.org</title><path
            d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"
          /></svg
        >
        {itemResult["copyReact"]?.label ?? "Copy as React"}
      </button>
      <button
        class={itemClass("copySVG")}
        role="menuitem"
        disabled={svgDisabled}
        onclick={handleCopySVG}
      >
        <svg
          class="size-4"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          ><title>SVG - simpleicons.org</title><path
            d="M12 0c-1.497 0-2.749.965-3.248 2.17a3.45 3.45 0 00-.238 1.416 3.459 3.459 0 00-1.168-.834 3.508 3.508 0 00-1.463-.256 3.513 3.513 0 00-2.367 1.02c-1.06 1.058-1.263 2.625-.764 3.83.179.432.47.82.82 1.154a3.49 3.49 0 00-1.402.252C.965 9.251 0 10.502 0 12c0 1.497.965 2.749 2.17 3.248.437.181.924.25 1.414.236-.357.338-.65.732-.832 1.17-.499 1.205-.295 2.772.764 3.83 1.058 1.06 2.625 1.263 3.83.764.437-.181.83-.476 1.168-.832-.014.49.057.977.238 1.414C9.251 23.035 10.502 24 12 24c1.497 0 2.749-.965 3.248-2.17a3.45 3.45 0 00.238-1.416c.338.356.73.653 1.168.834 1.205.499 2.772.295 3.83-.764 1.06-1.058 1.263-2.625.764-3.83a3.459 3.459 0 00-.834-1.168 3.45 3.45 0 001.416-.238C23.035 14.749 24 13.498 24 12c0-1.497-.965-2.749-2.17-3.248a3.455 3.455 0 00-1.414-.236c.357-.338.65-.732.832-1.17.499-1.205.295-2.772-.764-3.83a3.513 3.513 0 00-2.367-1.02 3.508 3.508 0 00-1.463.256c-.437.181-.83.475-1.168.832a3.45 3.45 0 00-.238-1.414C14.749.965 13.498 0 12 0zm-.041 1.613a1.902 1.902 0 011.387 3.246v3.893L16.098 6A1.902 1.902 0 1118 7.902l-2.752 2.752h3.893a1.902 1.902 0 110 2.692h-3.893L18 16.098A1.902 1.902 0 1116.098 18l-2.752-2.752v3.893a1.902 1.902 0 11-2.692 0v-3.893L7.902 18A1.902 1.902 0 116 16.098l2.752-2.752H4.859a1.902 1.902 0 110-2.692h3.893L6 7.902A1.902 1.902 0 117.902 6l2.752 2.752V4.859a1.902 1.902 0 011.305-3.246z"
          /></svg
        >
        {itemResult["copySVG"]?.label ?? "Copy as SVG"}
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
        class={itemClass("downloadSVG")}
        role="menuitem"
        disabled={svgDisabled}
        onclick={handleDownloadSVG}
      >
        <ImageDown class="size-4" />
        {itemResult["downloadSVG"]?.label ?? "Download SVG"}
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
