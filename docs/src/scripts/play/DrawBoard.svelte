<script lang="ts">
  import type { Engine, Point, TrailStyle } from "@sarmal/core";
  import { createEngine } from "@sarmal/core";
  import {
    computeNormal,
    getPaletteColor,
    resolveHeadColor,
    TRAIL_FADE_CURVE,
    TRAIL_MAX_OPACITY,
  } from "../../../../packages/sarmal/src/renderer-shared";
  import { onDestroy, untrack } from "svelte";
  import { buildDrawCurveDef, type DrawingSegment } from "./catmull-rom";

  interface Props {
    trailLength: number;
    speed: number;
    trailStyle?: TrailStyle;
    trailColor: string | string[];
    skeletonColor: string;
    headColor?: string;
    headColorAuto?: boolean;
    initialPoints?: Array<DrawingSegment>;
    showControls?: boolean;
    onPointsChange?: (points: Array<DrawingSegment>) => void;
  }

  let {
    trailLength,
    speed,
    trailStyle = "default",
    trailColor,
    skeletonColor,
    headColor,
    headColorAuto = false,
    initialPoints = [],
    showControls = true,
    onPointsChange,
  }: Props = $props();

  const MAX_TRAIL_SEGMENTS = 200;
  /**
   * ! Mirrors TRAIL_MIN_WIDTH / TRAIL_MAX_WIDTH in renderer-shared.ts,
   * ! but in SVG math-space units (~0.001–0.005) rather than pixel units (0.5–2.5)
   * ! If renderer-shared.ts changes, these must be revisited
   */
  const TRAIL_HALF_MIN = 0.001;
  const TRAIL_HALF_MAX = 0.005;

  let points = $state<Array<DrawingSegment>>([]);
  let dragIndex = $state<number | null>(null);
  let popoverIndex = $state<number | null>(null);
  let isAnimating = $state(false);

  let engine: Engine | null = null;
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let gradientAnimTime = 0;

  let skeletonD = $state("");
  let headPos = $state<Point | null>(null);

  let trailGroup = $state<SVGGElement | null>(null);
  let trailPathEls: SVGPathElement[] = [];

  const strokeColor = $derived(
    typeof trailColor === "string" ? trailColor : (trailColor[0] ?? "#ffffff"),
  );

  const resolvedHeadColor = $derived(
    headColorAuto
      ? resolveHeadColor(trailColor, trailStyle)
      : (headColor ?? strokeColor),
  );

  $effect(() => {
    const g = trailGroup;
    if (g == null) {
      return;
    }

    for (let i = 0; i < MAX_TRAIL_SEGMENTS; i++) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      g.appendChild(p);
      trailPathEls.push(p);
    }
    return () => {
      trailPathEls = [];
    };
  });

  function gradientColor(
    palette: string[],
    pos: number,
    timeOffset: number,
  ): string {
    const { r, g, b } = getPaletteColor(palette, pos, timeOffset);
    return `rgb(${r},${g},${b})`;
  }

  function renderTrailRibbon(trail: Point[], count: number) {
    if (trailPathEls.length === 0 || count < 2) {
      for (const p of trailPathEls) p.setAttribute("d", "");
      return;
    }

    const startIdx = Math.max(0, count - 1 - MAX_TRAIL_SEGMENTS);
    const drawnCount = count - 1 - startIdx;
    const isGradient = trailStyle !== "default";
    const palette =
      isGradient && Array.isArray(trailColor) ? (trailColor as string[]) : [];
    const timeOff =
      trailStyle === "gradient-animated" ? gradientAnimTime * 0.0005 : 0;
    const solid = strokeColor;

    for (let i = startIdx; i < count - 1; i++) {
      const j = i - startIdx;
      const progress = i / (count - 1);
      const nextProgress = (i + 1) / (count - 1);
      const opacity = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
      const w0 = TRAIL_HALF_MIN + progress * (TRAIL_HALF_MAX - TRAIL_HALF_MIN);
      const w1 =
        TRAIL_HALF_MIN + nextProgress * (TRAIL_HALF_MAX - TRAIL_HALF_MIN);

      const n0 = computeNormal(trail, i);
      const n1 = computeNormal(trail, i + 1);
      const cx = trail[i]!.x,
        cy = trail[i]!.y;
      const nx = trail[i + 1]!.x,
        ny = trail[i + 1]!.y;

      const d =
        `M${(cx + n0.x * w0).toFixed(4)} ${(cy + n0.y * w0).toFixed(4)}` +
        ` L${(nx + n1.x * w1).toFixed(4)} ${(ny + n1.y * w1).toFixed(4)}` +
        ` L${(nx - n1.x * w1).toFixed(4)} ${(ny - n1.y * w1).toFixed(4)}` +
        ` L${(cx - n0.x * w0).toFixed(4)} ${(cy - n0.y * w0).toFixed(4)} Z`;

      const el = trailPathEls[j]!;
      el.setAttribute("d", d);
      el.setAttribute("fill-opacity", opacity.toFixed(3));
      el.setAttribute(
        "fill",
        isGradient ? gradientColor(palette, progress, timeOff) : solid,
      );
    }

    for (let i = drawnCount; i < trailPathEls.length; i++) {
      trailPathEls[i]!.setAttribute("d", "");
    }
  }

  $effect(() => {
    if (initialPoints.length > 0) {
      points = [...initialPoints];
    }
  });

  $effect(() => {
    onPointsChange?.([...points]);
  });

  // Dashed straight-line polygon connecting control points
  const polygonPointsStr = $derived(
    points.map((p) => `${p[0]},${p[1]}`).join(" "),
  );

  let svgElement: SVGSVGElement;
  let popoverElement: HTMLDivElement | undefined = $state(undefined);
  let dragStartX = 0;
  let dragStartY = 0;
  let hasDragged = false;
  let isDraggingNewPoint = false;

  function getSvgPoint(clientX: number, clientY: number): DrawingSegment {
    const rect = svgElement.getBoundingClientRect();
    const x = -1 + (2 * (clientX - rect.left)) / rect.width;
    const y = -1 + (2 * (clientY - rect.top)) / rect.height;
    return [x, y];
  }

  function handleSvgPointerDown(e: PointerEvent) {
    e.preventDefault();
    const target = e.target as Element;

    if (target.closest("circle")) {
      // On the very small chance that the user clicks the animated curve's head
      return;
    }

    if (popoverIndex !== null) {
      popoverIndex = null;
      return;
    }

    const [x, y] = getSvgPoint(e.clientX, e.clientY);
    points = [...points, [x, y]];
    dragIndex = points.length - 1;
    isDraggingNewPoint = true;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    svgElement.setPointerCapture(e.pointerId);
  }

  function handlePointPointerDown(e: PointerEvent, index: number) {
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

    if (!hasDragged && !isDraggingNewPoint) {
      popoverIndex = dragIndex;
    }

    dragIndex = null;
    hasDragged = false;
    isDraggingNewPoint = false;
  }

  function handlePointerCancel() {
    dragIndex = null;
    hasDragged = false;
    isDraggingNewPoint = false;
  }

  function deletePoint(index: number) {
    points = points.filter((_, i) => i !== index);
    popoverIndex = null;
  }

  export function deletePointAt(index: number) {
    deletePoint(index);
  }

  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    lastTime = null;
  }

  function loop(now: number) {
    if (!engine) {
      return;
    }

    if (lastTime === null) {
      lastTime = now;
      rafId = requestAnimationFrame(loop);
      return;
    }
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (trailStyle === "gradient-animated") {
      gradientAnimTime += dt * 1000;
    }

    const trail = engine.tick(dt);
    const count = engine.trailCount;

    renderTrailRibbon(trail, count);
    headPos =
      count > 0 ? { x: trail[count - 1]!.x, y: trail[count - 1]!.y } : null;

    rafId = requestAnimationFrame(loop);
  }

  function buildEngine() {
    stopLoop();
    engine = null;
    for (const p of trailPathEls) {
      p.setAttribute("d", "");
    }

    headPos = null;
    isAnimating = false;

    const curveDef = buildDrawCurveDef(points);
    const len = untrack(() => trailLength);
    const spd = untrack(() => speed);

    engine = createEngine(curveDef, len);
    engine.setSpeed(spd);

    // Build skeleton path from engine (math space = SVG viewBox space, no transform)
    const skel = engine.getSarmalSkeleton();
    if (skel.length >= 2) {
      let d = `M${skel[0]!.x.toFixed(4)} ${skel[0]!.y.toFixed(4)}`;
      for (let i = 1; i < skel.length; i++) {
        d += ` L${skel[i]!.x.toFixed(4)} ${skel[i]!.y.toFixed(4)}`;
      }

      skeletonD = d + " Z";
    }

    isAnimating = true;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function destroyEngine() {
    stopLoop();
    engine = null;
    for (const p of trailPathEls) {
      p.setAttribute("d", "");
    }
    skeletonD = "";
    headPos = null;
    isAnimating = false;
  }

  // Rebuild engine when points stabilize (not mid-drag)
  $effect(() => {
    const pts = points;
    const dragging = dragIndex;
    if (dragging !== null) {
      return;
    }

    if (pts.length >= 3) {
      buildEngine();
    } else {
      destroyEngine();
    }
  });

  // Sync speed to running engine without subscribing to engine.
  $effect(() => {
    const s = speed;
    untrack(() => {
      if (engine) {
        engine.setSpeed(s);
      }
    });
  });

  export function clearPoints() {
    points = [];
    popoverIndex = null;
    destroyEngine();
  }

  export function getPoints(): Array<DrawingSegment> {
    return points.map((p) => [p[0], p[1]]);
  }

  export function rebuildInstance() {
    if (points.length < 3) {
      return;
    }
    buildEngine();
  }

  onDestroy(() => {
    stopLoop();
    engine = null;
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
  class="absolute {showControls
    ? 'cursor-crosshair bg-surface rounded-lg border border-dashed border-foreground/10'
    : 'cursor-default bg-transparent'} inset-0 w-full h-full"
  viewBox="-1 -1 2 2"
  width="100%"
  height="100%"
  overflow="visible"
  preserveAspectRatio="xMidYMid meet"
  onpointerdown={showControls ? handleSvgPointerDown : undefined}
  onpointermove={showControls ? handlePointPointerMove : undefined}
  onpointerup={showControls ? handlePointPointerUp : undefined}
  onpointercancel={showControls ? handlePointerCancel : undefined}
  role="img"
  aria-label="Drawing board for placing curve control points"
>
  <!-- Skeleton loop -->
  {#if isAnimating && skeletonD}
    <path
      d={skeletonD}
      fill="none"
      stroke={skeletonColor}
      stroke-width="0.008"
      stroke-linejoin="round"
      opacity="0.5"
    />
  {/if}

  <!-- Dashed polygon that connects control points -->
  {#if showControls && points.length >= 2}
    <polygon
      points={polygonPointsStr}
      fill="none"
      stroke={isAnimating ? strokeColor : "currentColor"}
      stroke-width="0.007"
      stroke-dasharray="0.04 0.025"
      stroke-linejoin="round"
      opacity={isAnimating ? 0.18 : 0.28}
      class={isAnimating ? "" : "text-foreground"}
    />
  {/if}

  <g bind:this={trailGroup}></g>

  <!-- Head dot -->
  {#if headPos}
    <circle cx={headPos.x} cy={headPos.y} r="0.028" fill={resolvedHeadColor} />
  {/if}

  <!-- Control point dots -->
  {#if showControls}
    {#each points as point, i (i)}
      {@const isLast = i === points.length - 1}
      <g class="cursor-pointer">
        {#if isLast}
          <circle
            cx={point[0]}
            cy={point[1]}
            r="0.072"
            fill={strokeColor}
            opacity="0.18"
            class="pointer-events-none"
          ></circle>
        {/if}

        <circle
          cx={point[0]}
          cy={point[1]}
          r={isLast ? 0.052 : 0.045}
          class="fill-surface-raised"
          stroke={strokeColor}
          stroke-width={isLast ? 0.015 : 0.012}
          onpointerdown={(e) => handlePointPointerDown(e, i)}
          role="button"
          tabindex="0"
          aria-label="Control point {i + 1}"
        ></circle>

        {#if isLast}
          <circle
            cx={point[0]}
            cy={point[1]}
            r="0.022"
            fill={strokeColor}
            class="pointer-events-none"
          ></circle>
        {/if}
      </g>
    {/each}
  {/if}
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
