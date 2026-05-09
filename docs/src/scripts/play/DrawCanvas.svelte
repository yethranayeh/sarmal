<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type DrawBoardComponent from "./DrawBoard.svelte";
  import type { DrawingSegment } from "./types";

  import { Import } from "@lucide/svelte";
  import { getContext } from "svelte";

  import Button from "../../components/Button.svelte";
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
    class="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none gap-6"
  >
    <div class="text-center max-w-85 px-6 select-none">
      <h2
        class="font-heading italic text-[26px] leading-tight font-normal text-muted-dark m-0"
      >
        <span class="select-text">Begin</span> with a
        <span class="text-primary">gesture</span>.
      </h2>
      <p
        class="font-ui text-[11px] tracking-[0.04em] leading-[1.6] text-muted-gray mt-3"
      >
        Click to place a point.<br />
        Three or more become a curve.
      </p>
    </div>

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
      pg.drawInitialPoints = points;
      pg.drawPoints = [...points];
      dialogOpen = false;
    }}
  />
{/if}
