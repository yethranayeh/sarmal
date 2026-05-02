<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";

  import { getContext } from "svelte";

  const pg = getContext<PlaygroundState>("playground");
  let svgEl = $state<SVGSVGElement | null>(null);

  $effect(() => {
    pg.previewRef.current = svgEl;
    return () => {
      pg.previewRef.current = null;
    };
  });
</script>

<svg
  bind:this={svgEl}
  class="absolute inset-0 w-full h-full {pg.currentMode === 'draw'
    ? 'pointer-events-none'
    : ''}"
></svg>
