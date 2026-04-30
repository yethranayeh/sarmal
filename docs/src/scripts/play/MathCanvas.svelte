<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";

  import { getContext } from "svelte";

  const pg = getContext<PlaygroundState>("playground");
  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    pg.canvasRef.current = canvas;
    return () => {
      pg.canvasRef.current = null;
    };
  });
</script>

<canvas
  bind:this={canvas}
  id="preview-canvas"
  width="640"
  height="640"
  class="absolute inset-0 w-full h-full"
></canvas>
