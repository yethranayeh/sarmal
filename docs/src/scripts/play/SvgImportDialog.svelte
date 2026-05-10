<script lang="ts">
  import type { DrawingSegment } from "./types";
  import type { ParseResult } from "./parseSvgInput";

  import {
    CheckIcon,
    CircleCheck,
    CircleCheckBig,
    ClipboardCheck,
    Import,
    TriangleAlert,
    TriangleDashed,
    Upload,
    X,
  } from "@lucide/svelte";

  import { parseSvgInput } from "./parseSvgInput";

  import Button from "../../components/Button.svelte";

  interface Props {
    open: boolean;
    onClose: () => void;
    onImport: (points: Array<DrawingSegment>) => void;
  }

  let { open, onClose, onImport }: Props = $props();

  let input = $state("");
  let parseStatus = $state<"idle" | "parsed" | "error">("idle");
  let parseResult = $state<ParseResult | null>(null);
  let dialogEl = $state<HTMLDialogElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);
  let isDragging = $state(false);
  let fileError = $state<string | null>(null);

  const canImport = $derived(parseStatus === "parsed" && parseResult?.ok);
  const pointCount = $derived(parseResult?.ok ? parseResult.points.length : 0);
  const warnings = $derived(parseResult?.ok ? parseResult.warnings : []);
  const isLoadedFromMeta = $derived(
    parseResult?.ok &&
      parseResult.warnings.length === 0 &&
      parseResult.points.every(
        (p) => p[0] >= -1 && p[0] <= 1 && p[1] >= -1 && p[1] <= 1,
      ),
  );
  const errorMessage = $derived(
    parseResult && !parseResult.ok && parseResult.error
      ? parseResult.error
      : null,
  );
  const showStatus = $derived(
    parseStatus === "parsed" || parseStatus === "error",
  );

  $effect(() => {
    const d = dialogEl;
    const o = open;
    if (!d) {
      return;
    }

    if (o && !d.open) {
      d.showModal();
    } else if (!o && d.open) {
      d.close();
    }
  });

  $effect(() => {
    if (open) {
      input = "";
      parseStatus = "idle";
      parseResult = null;
      isDragging = false;
      fileError = null;
    }
  });

  $effect(() => {
    const value = input.trim();
    if (!value) {
      parseResult = null;
      parseStatus = "idle";
      return;
    }

    const timer = setTimeout(() => {
      const result = parseSvgInput(value);

      if (result.ok) {
        parseResult = result;
        parseStatus = "parsed";
      } else if (result.error) {
        parseResult = result;
        parseStatus = "error";
      } else {
        parseResult = null;
        parseStatus = "idle";
      }
    }, 150);

    return () => clearTimeout(timer);
  });

  function handleClose() {
    onClose();
  }

  function handleImport() {
    if (parseResult?.ok) {
      onImport(parseResult.points);
    }
  }

  function handleDialogClose() {
    if (open) {
      onClose();
    }
  }

  function readFile(file: File) {
    if (file.type !== "image/svg+xml" && !file.name.endsWith(".svg")) {
      fileError = "Only .svg files are supported.";
      return;
    }

    fileError = null;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        input = reader.result;
      }
    };
    reader.onerror = () => {
      fileError = "Could not read the file.";
    };

    reader.readAsText(file);
  }

  function handleFilePick(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    readFile(file);
    target.value = "";
  }

  function triggerFilePick() {
    fileInput?.click();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    readFile(file);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<dialog
  bind:this={dialogEl}
  onclose={handleDialogClose}
  class="svg-import-dialog backdrop:bg-foreground/40 backdrop:backdrop-blur-sm bg-transparent p-0 m-auto max-w-none w-full max-h-none outline-none"
>
  <div
    class="bg-surface border border-border rounded-xl w-[min(90vw,400px)] mx-auto my-auto shadow-xl p-5 flex flex-col gap-4"
  >
    <div class="flex items-center justify-between">
      <h2 class="font-heading text-lg leading-none m-0 text-foreground">
        Import SVG Path
      </h2>
      <button
        onclick={handleClose}
        class="cursor-pointer rounded-full p-1.5 text-muted-gray hover:text-foreground hover:bg-foreground/8 transition-colors"
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>

    <p id="svg-import-disclaimer" class="text-xs text-foreground font-ui">
      SVG curves exported from the playground import <span class="text-primary"
        >losslessly</span
      >. SVGs from other tools (Figma, Illustrator, etc.) will be
      <em>sampled</em>, so minor approximation should be expected.
    </p>

    <textarea
      bind:value={input}
      aria-describedby="svg-import-disclaimer"
      aria-invalid={parseStatus === "error"}
      placeholder="Paste an SVG `d` attribute, a `<path>` element, or a full `<svg>` block"
      spellcheck="false"
      rows="6"
      class="w-full px-3 py-2.5 font-mono text-xs leading-loose text-foreground bg-surface-raised border border-border rounded-lg resize-none outline-none focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-gray/50"
    ></textarea>

    <input
      bind:this={fileInput}
      type="file"
      accept=".svg"
      onchange={handleFilePick}
      class="hidden"
    />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      ondragenter={(e) => {
        e.preventDefault();
        isDragging = true;
      }}
      ondragover={(e) => e.preventDefault()}
      ondragleave={(e) => {
        const zone = e.currentTarget as HTMLElement;
        if (!zone.contains(e.relatedTarget as Node)) {
          isDragging = false;
        }
      }}
      ondrop={handleDrop}
      onclick={triggerFilePick}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          triggerFilePick();
        }
      }}
      role="button"
      tabindex="0"
      class="border-2 border-dashed rounded-lg py-4 px-4 flex items-center justify-center gap-2 cursor-pointer text-xs font-ui bg-background text-muted-gray transition-colors {isDragging
        ? 'border-foreground bg-surface-raised text-foreground'
        : 'border-border'}"
    >
      <Upload size={14} />
      Drop an .svg file here, or click to browse
    </div>

    {#if fileError}
      <div class="text-xs text-error font-ui flex items-center gap-1.5">
        <TriangleAlert size={14} />
        {fileError}
      </div>
    {/if}

    {#if showStatus}
      <div aria-live="polite" class="flex flex-col gap-2">
        {#if errorMessage}
          <div
            class="text-xs text-error font-ui flex items-center leading-none gap-1.5"
          >
            <TriangleAlert />
            {errorMessage}
          </div>
        {/if}

        {#if warnings.length > 0}
          {#each warnings as warning}
            <div class="text-xs text-warning font-ui flex items-start gap-1.5">
              <TriangleDashed />
              {warning}
            </div>
          {/each}
        {/if}

        {#if canImport}
          <div class="text-xs text-success font-ui flex items-center gap-1.5">
            <ClipboardCheck size={16} />
            {pointCount}
            {isLoadedFromMeta
              ? " points loaded from metadata"
              : ` points sampled`}
          </div>
        {/if}
      </div>
    {/if}

    <div class="flex items-center justify-end gap-2 pt-1">
      <Button variant="ghost" onclick={handleClose}>Cancel</Button>
      <Button variant="primary" disabled={!canImport} onclick={handleImport}>
        <Import size={13} />
        Import Points
      </Button>
    </div>
  </div>
</dialog>

<style>
  @starting-style {
    dialog[open].svg-import-dialog > div {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    dialog[open].svg-import-dialog > div {
      transition:
        opacity 200ms ease-out,
        transform 200ms ease-out;
    }
  }
</style>
