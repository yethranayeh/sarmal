<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";

  import { getContext } from "svelte";
  import { Trash, PanelLeft } from "@lucide/svelte";

  import MathCanvas from "./MathCanvas.svelte";
  import DrawCanvas from "./DrawCanvas.svelte";
  import ShareDropdown from "./ShareDropdown.svelte";
  import Button from "../../components/Button.svelte";

  const pg = getContext<PlaygroundState>("playground");
</script>

<section
  class="flex-1 relative bg-surface-raised dark:bg-surface overflow-hidden"
>
  <!-- dot grid decoration -->
  <div
    class="absolute inset-0 bg-[radial-gradient(color-mix(in_srgb,var(--color-foreground)_7%,transparent)_0.8px,transparent_0.8px)] bg-size-[28px_28px] pointer-events-none"
  ></div>

  <!-- Square canvas inset -->
  <div class="absolute inset-0 flex items-center justify-center p-10">
    <div
      class="relative w-full max-w-[min(640px,calc(100dvh-137px))] aspect-square"
    >
      <MathCanvas />
      {#if pg.currentMode === "draw"}
        <DrawCanvas />
      {/if}
    </div>
  </div>

  <!-- Floating: sidebar toggle + mode segmented control (top-left) -->
  <div class="absolute top-4 left-4 z-10 flex items-center gap-2">
    {#if !pg.sidebarVisible}
      <button
        class="lg:hidden p-2 rounded-full bg-surface/90 backdrop-blur-md border border-border shadow-[0_1px_2px_color-mix(in_srgb,var(--color-foreground)_4%,transparent)] text-foreground cursor-pointer hover:text-primary transition-colors"
        onclick={() => (pg.sidebarVisible = true)}
        aria-label="Open controls"
      >
        <PanelLeft class="w-4 h-4" />
      </button>
    {/if}

    <div
      class="group inline-flex items-center bg-surface/90 backdrop-blur-md border border-border rounded-full p-0.75 gap-0.5 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-foreground)_4%,transparent)]"
    >
      {#each ["math", "draw"] as mode}
        <button
          class="px-4 py-1.5 rounded-full font-body text-[11px] font-semibold uppercase tracking-[0.08em] cursor-pointer transition-colors duration-300 bg-transparent {pg.currentMode ===
          mode
            ? 'text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => pg.switchMode(mode as "math" | "draw")}
        >
          {mode}
        </button>
      {/each}
      <div
        class="bg-primary w-17 group-hover:w-18 h-7 rounded-full absolute -z-1 {pg.currentMode ===
        'math'
          ? 'left-1'
          : 'left-[50%] group-hover:left-[47%]'} {pg.isSliding
          ? 'is-sliding'
          : ''}"
        style="transition: left 300ms cubic-bezier(0.34, 1.2, 0.64, 1), width 300ms cubic-bezier(0.34, 1.2, 0.64, 1);"
      ></div>
    </div>
  </div>

  <!-- Floating: share / clear (top-right) -->
  <div class="absolute top-4 right-4 z-10 flex items-center gap-2">
    <ShareDropdown />
    <Button active onclick={pg.handleClear} variant="ghost">
      <Trash class="w-3.5 h-3.5" />
      Clear
    </Button>
  </div>

  <!-- Mode tag (bottom-left) -->
  <div class="absolute bottom-6 left-6 z-10 pointer-events-none">
    <span
      class="font-heading italic font-medium text-[28px] leading-none tracking-[-0.01em] text-muted-foreground select-none"
    >
      {pg.currentMode === "math" ? "Parametric" : "Hand-drawn"}
    </span>
  </div>
</section>

<style>
  @media (prefers-reduced-motion: no-preference) {
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
