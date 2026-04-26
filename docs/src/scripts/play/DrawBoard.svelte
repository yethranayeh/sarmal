<script lang="ts">
  import type { Engine, TrailStyle } from "@sarmal/core";

  import { createEngine, createRenderer } from "@sarmal/core";
  import { onDestroy } from "svelte";
  import {
    buildSplinePath,
    buildClosingPath,
    buildDrawCurveDef,
    type DrawingSegment,
  } from "./catmull-rom";

  interface Props {
    canvas: HTMLCanvasElement;
    trailLength: number;
    speed: number;
    trailStyle: TrailStyle;
    trailColor: string | string[];
    skeletonColor: string;
    headColor?: string;
    headColorAuto?: boolean;
    initialPoints?: Array<DrawingSegment>;
    onCanAnimateChange?: (canAnimate: boolean) => void;
    onAnimateModeChange?: (isAnimating: boolean) => void;
  }

  let {
    canvas,
    trailLength,
    speed,
    trailStyle,
    trailColor,
    skeletonColor,
    headColor,
    headColorAuto = false,
    initialPoints = [],
    onCanAnimateChange,
    onAnimateModeChange,
  }: Props = $props();

  let points = $state<Array<DrawingSegment>>([]);
  let dragIndex = $state<number | null>(null);
  let popoverIndex = $state<number | null>(null);
  let isAnimating = $state(false);
  let engine = $state<Engine | null>(null);
  let instance = $state<ReturnType<typeof createRenderer> | null>(null);

  $effect(() => {
    if (initialPoints.length > 0) {
      points = [...initialPoints];
    }
  });

  $effect(() => {
    onCanAnimateChange?.(points.length >= 3);
  });

  $effect(() => {
    onAnimateModeChange?.(isAnimating);
  });

  let splinePath = $derived(buildSplinePath(points));
  let closingPath = $derived(buildClosingPath(points));

  let svgElement: SVGSVGElement;
  let popoverElement: HTMLDivElement | undefined = $state(undefined);

  let dragStartX = 0;
  let dragStartY = 0;
  let hasDragged = false;

  function getSvgPoint(clientX: number, clientY: number): DrawingSegment {
    const rect = svgElement.getBoundingClientRect();
    const x = -1 + (2 * (clientX - rect.left)) / rect.width;
    const y = -1 + (2 * (clientY - rect.top)) / rect.height;
    return [x, y];
  }

  function handleSvgPointerDown(e: PointerEvent) {
    if (isAnimating) {
      return;
    }

    e.preventDefault();
    const target = e.target as Element;
    if (target.closest("circle")) {
      return;
    }

    if (popoverIndex !== null) {
      popoverIndex = null;
      return;
    }

    const [x, y] = getSvgPoint(e.clientX, e.clientY);
    points = [...points, [x, y]];
  }

  function handlePointPointerDown(e: PointerEvent, index: number) {
    if (isAnimating) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    dragIndex = index;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function handlePointPointerMove(e: PointerEvent) {
    if (dragIndex === null || !svgElement) {
      return;
    }

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasDragged = true;
    }

    if (hasDragged) {
      const [x, y] = getSvgPoint(e.clientX, e.clientY);
      points = points.map((p, i) => (i === dragIndex ? [x, y] : p));
    }
  }

  function handlePointPointerUp(_e: PointerEvent) {
    if (dragIndex === null) {
      return;
    }

    if (!hasDragged) {
      popoverIndex = dragIndex;
    }

    dragIndex = null;
    hasDragged = false;
  }

  function handlePointerCancel() {
    dragIndex = null;
    hasDragged = false;
  }

  function deletePoint(index: number) {
    points = points.filter((_, i) => i !== index);
    popoverIndex = null;
  }

  function enterAnimateMode() {
    if (points.length < 3) {
      return;
    }

    const curveDef = buildDrawCurveDef(points);

    if (instance) {
      instance.destroy();
      instance = null;
    }

    if (engine) {
      engine = null;
    }

    engine = createEngine(curveDef, trailLength);

    const options: Parameters<typeof createRenderer>[0] = {
      canvas,
      engine,
      trailColor,
      skeletonColor,
      trailStyle,
      autoStart: true,
    };

    if (!headColorAuto && headColor) {
      options.headColor = headColor;
    }

    instance = createRenderer(options);
    isAnimating = true;
  }

  function exitAnimateMode() {
    instance?.pause();
    isAnimating = false;
  }

  export function toggleAnimate() {
    if (isAnimating) {
      exitAnimateMode();
    } else {
      enterAnimateMode();
    }
  }

  export function clearPoints() {
    points = [];
    popoverIndex = null;

    if (isAnimating) {
      exitAnimateMode();
    }
    if (instance) {
      instance.destroy();
      instance = null;
    }
    engine = null;
  }

  export function getIsAnimating() {
    return isAnimating;
  }

  export function getPoints(): Array<DrawingSegment> {
    return points.map((p) => [p[0], p[1]]);
  }

  export function rebuildInstance() {
    if (!isAnimating || points.length < 3) {
      return;
    }

    enterAnimateMode();
  }

  onDestroy(() => {
    if (instance) {
      instance.destroy();
      instance = null;
    }
    engine = null;
  });

  $effect(() => {
    if (!instance || !isAnimating) return;
    instance.setRenderOptions({
      trailColor,
      skeletonColor,
      trailStyle,
      headColor: headColorAuto ? null : headColor,
    });
    instance.setSpeed(speed);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      popoverIndex = null;
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  bind:this={svgElement}
  class="absolute inset-0 w-full h-full"
  class:pointer-events-none={isAnimating}
  class:pointer-events-auto={!isAnimating}
  viewBox="-1 -1 2 2"
  width="100%"
  height="100%"
  overflow="visible"
  preserveAspectRatio="xMidYMid meet"
  onpointerdown={handleSvgPointerDown}
  onpointermove={handlePointPointerMove}
  onpointerup={handlePointPointerUp}
  onpointercancel={handlePointerCancel}
  role="img"
  aria-label="Drawing board for placing curve control points"
>
  {#if splinePath}
    <path
      d={splinePath}
      fill="none"
      stroke="currentColor"
      stroke-width="0.02"
      class="text-foreground"
    />
  {/if}
  {#if closingPath}
    <path
      d={closingPath}
      fill="none"
      stroke="currentColor"
      stroke-width="0.02"
      class="text-foreground"
      stroke-dasharray="0.05"
      opacity="0.4"
    />
  {/if}
  {#each points as point, i (i)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <circle
      cx={point[0]}
      cy={point[1]}
      r="0.04"
      fill="currentColor"
      class="text-primary cursor-pointer"
      onpointerdown={(e) => handlePointPointerDown(e, i)}
      role="button"
      tabindex="0"
      aria-label="Control point {i + 1}"
    />
  {/each}
</svg>

{#if popoverIndex !== null}
  {@const point = points[popoverIndex]}
  {#if point}
    <div
      bind:this={popoverElement}
      class="absolute z-10 bg-surface border border-border rounded-md shadow-lg p-2"
      style="left: {((point[0] + 1) / 2) * 100}%; top: {((point[1] + 1) / 2) *
        100}%; transform: translate(-50%, -120%);"
    >
      <button
        class="font-mono text-xs px-2 py-1 text-error hover:bg-surface-raised rounded transition-colors whitespace-nowrap cursor-pointer"
        onclick={() => deletePoint(popoverIndex!)}
      >
        Delete point
      </button>
    </div>
  {/if}
{/if}

<style>
  circle:focus {
    outline: none;
  }
</style>
