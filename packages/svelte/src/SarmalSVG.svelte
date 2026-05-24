<script lang="ts">
  import type {
    CurveDef,
    SarmalInstance,
  } from "@sarmal/core";
  import type { SarmalSVGProps } from "./types";

  import { untrack } from "svelte";
  import { createSarmalSVG } from "@sarmal/core";

  let {
    curve,
    class: className = "",
    style: styleStr = "",
    trailColor,
    skeletonColor,
    headColor,
    trailStyle,
    morphDuration,
    morphStrategy,
    instance = $bindable(null as SarmalInstance | null),
    trailLength,
    headRadius,
    trailWidth,
    autoStart,
    initialPhase,
    pauseOnHidden,
    onready,
  }: SarmalSVGProps = $props();

  let svg = $state<SVGSVGElement | null>(null);
  let committedCurve: CurveDef | null = null;

  $effect(() => {
    const s = svg;
    if (!s) {
      return;
    }

    const initCurve = untrack(() => curve);
    const initRuntimeOpts = untrack(() => ({
      ...(trailColor !== undefined && { trailColor }),
      ...(skeletonColor !== undefined && { skeletonColor }),
      ...(headColor !== undefined && { headColor }),
      ...(trailStyle !== undefined && { trailStyle }),
      ...(trailWidth !== undefined && { trailWidth }),
    }));

    const inst = createSarmalSVG(s, initCurve, {
      ...initRuntimeOpts,
      ...(trailLength !== undefined && { trailLength }),
      ...(headRadius !== undefined && { headRadius }),
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
      ...(headColor !== undefined ? { headColor } : { headColor: null }),
      ...(trailStyle !== undefined && { trailStyle }),
      ...(trailWidth !== undefined && { trailWidth }),
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

<svg bind:this={svg} class={className} style={styleStr} />
