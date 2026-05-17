<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type DrawBoardComponent from "./DrawBoard.svelte";
  import type { DrawingSegment } from "./types";

  import Import from "../../components/icons/Import.svelte";
  import { getContext } from "svelte";

  import Button from "../../components/Button.svelte";
  import EmptyStateGesture from "./EmptyStateGesture.svelte";
  import SvgImportDialog from "./SvgImportDialog.svelte";

  const pg = getContext<PlaygroundState>("playground");

  let dialogOpen = $state(false);
  let DrawBoard = $state<typeof DrawBoardComponent | null>(null);

  import("./DrawBoard.svelte").then((mod) => {
    DrawBoard = mod.default;
  });
</script>

{#if pg.drawPointCount === 0}
  <div
    class="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none gap-2 md:gap-6"
  >
    <EmptyStateGesture />

    <Button
      variant="outline"
      class="pointer-events-auto ring-1"
      onclick={() => (dialogOpen = true)}
    >
      <Import size={16} />
      Import</Button
    >
  </div>
{/if}

{#if DrawBoard}
  <DrawBoard
    bind:this={pg.drawBoardRef}
    trailLength={pg.trailLength}
    speed={pg.speed}
    trailStyle={pg.trailStyle}
    trailColor={pg.resolvedTrailColor}
    skeletonColor={pg.resolvedSkeletonColor}
    headColor={pg.headColor}
    headColorAuto={pg.headColorAuto}
    headRadius={(pg.headRadius ?? 0.5) * 0.02}
    trailWidth={pg.trailWidth ?? 1}
    initialPoints={pg.drawInitialPoints}
    showControls={pg.shouldShowDrawControls}
    onPointsChange={(pts: Array<DrawingSegment>) => (pg.drawPoints = pts)}
    onSvgRef={(el) => {
      pg.previewRef.current = pg.currentMode === "draw" ? el : null;
    }}
    onMouseMove={(x, y) => {
      pg.mouseSVGX = x;
      pg.mouseSVGY = y;
    }}
  />
{/if}

{#if dialogOpen}
  <SvgImportDialog
    open={dialogOpen}
    onClose={() => (dialogOpen = false)}
    onImport={(points) => {
      // drawInitialPoints flows into DrawBoard (input);
      // drawPoints flows out
      // ! both must be set to keep them in sync
      pg.drawInitialPoints = points;
      pg.drawPoints = [...points];
      dialogOpen = false;
    }}
  />
{/if}
