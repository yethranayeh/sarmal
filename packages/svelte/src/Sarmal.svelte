<script lang="ts">
  import type {
    CurveDef,
    TrailColor,
    TrailStyle,
    SarmalInstance,
  } from "@sarmal/core";

  import { untrack } from "svelte";
  import { createSarmal } from "@sarmal/core";
  import { resolveCanvasSize } from "./utils";

  interface Props {
    curve: CurveDef;
    class?: string;
    style?: string;
    trailColor?: TrailColor;
    skeletonColor?: string;
    headColor?: string;
    trailStyle?: TrailStyle;
    morphDuration?: number;
    instance?: SarmalInstance | null;
    trailLength?: number;
    headRadius?: number;
    autoStart?: boolean;
    initialPhase?: number;
    width?: number;
    height?: number;
    onready?: (instance: SarmalInstance) => void;
  }

  let {
    curve,
    class: className = "",
    style: styleStr = "",
    trailColor,
    skeletonColor,
    headColor,
    trailStyle,
    morphDuration,
    instance = $bindable(null as SarmalInstance | null),
    trailLength,
    headRadius,
    autoStart,
    initialPhase,
    width,
    height,
    onready,
  }: Props = $props();

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
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(headColor !== undefined && { headColor }),
      ...(trailStyle !== undefined && { trailStyle }),
    }));

    const inst = createSarmal(c, initCurve, {
      ...initRuntimeOpts,
      ...(trailLength !== undefined && { trailLength }),
      ...(headRadius !== undefined && { headRadius }),
      ...(autoStart !== undefined && { autoStart }),
      ...(initialPhase !== undefined && { initialPhase }),
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
      ?.morphTo(
        curve,
        morphDuration != null ? { duration: morphDuration } : undefined,
      )
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
      ...(headColor !== undefined ? { headColor } : { headColor: null }),
      ...(trailStyle !== undefined && { trailStyle }),
    });
  });

  $effect(() => {
    const inst = instance;
    if (!inst) return;
    onready?.(inst);
  });
</script>

<canvas bind:this={canvas} class={className} style={styleStr}></canvas>
