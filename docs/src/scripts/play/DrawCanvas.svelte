<script lang="ts">
  import type { PlaygroundState } from "./playgroundState.svelte";
  import type DrawBoardComponent from "./DrawBoard.svelte";
  import type { DrawingSegment } from "./types";

  import { getContext } from "svelte";

  const pg = getContext<PlaygroundState>("playground");

  let DrawBoard = $state<typeof DrawBoardComponent | null>(null);

  import("./DrawBoard.svelte").then((mod) => {
    DrawBoard = mod.default;
  });
</script>

{#if pg.drawPointCount === 0}
  <div
    class="absolute inset-0 flex items-center justify-center pointer-events-none"
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
    initialPoints={pg.drawInitialPoints}
    showControls={pg.shouldShowDrawControls}
    onPointsChange={(pts: Array<DrawingSegment>) => (pg.drawPoints = pts)}
  />
{/if}
