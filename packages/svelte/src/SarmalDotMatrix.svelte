<script lang="ts">
  import type {
    CurveDef,
    SarmalInstance,
    DotMatrixRuntimeRenderOptions,
  } from "@sarmal/core";
  import type { SarmalDotMatrixProps } from "./types";

  import { untrack } from "svelte";
  import { createSarmalDotMatrix } from "@sarmal/core";
  import { resolveCanvasSize } from "./utils";

  let {
    curve,
    class: className = "",
    style: styleStr = "",
    trailColor,
    trailStyle,
    skeletonColor,
    gridColor,
    morphDuration,
    morphStrategy,
    morphEasing,
    morphAlign,
    instance = $bindable(null as SarmalInstance<DotMatrixRuntimeRenderOptions> | null),
    cols,
    rows,
    roundness,
    trailLength,
    autoStart,
    initialPhase,
    pauseOnHidden,
    width,
    height,
    onready,
  }: SarmalDotMatrixProps = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let committedCurve: CurveDef | null = null;

  $effect(() => {
    const c = canvas;
    if (!c) {
      return;
    }

    const { width: w, height: h } = resolveCanvasSize(c, width, height);
    c.width = w;
    c.height = h;

    const initCurve = untrack(() => curve);
    const initRuntimeOpts = untrack(() => ({
      ...(trailColor !== undefined && { trailColor }),
      ...(trailStyle !== undefined && { trailStyle }),
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(gridColor !== undefined && { gridColor }),
    }));

    const inst = createSarmalDotMatrix(c, initCurve, {
      ...initRuntimeOpts,
      ...(cols !== undefined && { cols }),
      ...(rows !== undefined && { rows }),
      ...(roundness !== undefined && { roundness }),
      ...(trailLength !== undefined && { trailLength }),
      ...(autoStart !== undefined && { autoStart }),
      ...(initialPhase !== undefined && { initialPhase }),
      ...(pauseOnHidden !== undefined && { pauseOnHidden }),
    });

    instance = inst;
    committedCurve = initCurve;

    return () => {
      inst.destroy();
      instance = null;
      committedCurve = null;
    };
  });

  $effect(() => {
    if (committedCurve == null) {
      return;
    }

    if (curve === committedCurve) {
      return;
    }

    committedCurve = curve;
    instance
      ?.morphTo(curve, {
        ...(morphDuration != null && { duration: morphDuration }),
        ...(morphStrategy != null && { morphStrategy }),
        ...(morphEasing != null && { easing: morphEasing }),
        ...(morphAlign != null && { align: morphAlign }),
      })
      .catch(() => {});
  });

  $effect(() => {
    const inst = instance;
    if (!inst) {
      return;
    }

    inst.setRenderOptions({
      ...(trailColor !== undefined && { trailColor }),
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(trailStyle !== undefined && { trailStyle }),
      ...(gridColor !== undefined && { gridColor }),
    });
  });

  $effect(() => {
    const inst = instance;
    if (!inst) {
      return;
    }

    onready?.(inst);
  });
</script>

<canvas bind:this={canvas} class={className} style={styleStr}></canvas>
