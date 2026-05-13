import type { CurveDef, SarmalInstance, SarmalOptions } from "@sarmal/core";
import type { CanvasInit } from "./types";

import { untrack } from "svelte";
import { createSarmal } from "@sarmal/core";

import { canvasInitValuesEqual, resolveCanvasSize } from "./utils";
import { registerMorphEffect, registerRenderOptionsEffect } from "./use-morph-and-render.svelte";

export function useSarmal(
  canvasElement: HTMLCanvasElement | null,
  getCurve: () => CurveDef,
  getOptions?: () => Partial<SarmalOptions>,
  getInit?: () => CanvasInit,
  getMorphDuration?: () => number | undefined,
): {
  get instance(): SarmalInstance | null;
} {
  let instance = $state<SarmalInstance | null>(null);
  let committedCurve: CurveDef | null = null;
  let prevInit: CanvasInit | undefined;

  $effect(() => {
    const init = getInit?.();
    const c = canvasElement;
    if (!c) {
      return;
    }

    if (prevInit && canvasInitValuesEqual(prevInit, init)) {
      return;
    }
    prevInit = init;

    instance?.destroy();

    const initCurve = untrack(() => getCurve());
    const initRuntimeOpts = untrack(() => getOptions?.());

    const { width: w, height: h } = resolveCanvasSize(c, init?.width, init?.height);
    c.width = w;
    c.height = h;

    const inst = createSarmal(c, initCurve, {
      ...initRuntimeOpts,
      ...(init?.trailLength !== undefined && { trailLength: init.trailLength }),
      ...(init?.headRadius !== undefined && { headRadius: init.headRadius }),
      ...(init?.autoStart !== undefined && { autoStart: init.autoStart }),
      ...(init?.initialPhase !== undefined && { initialPhase: init.initialPhase }),
    });

    instance = inst;
    committedCurve = initCurve;

    return () => {
      inst.destroy();
      instance = null;
      committedCurve = null;
    };
  });

  registerMorphEffect(
    () => instance,
    {
      get value() {
        return committedCurve;
      },
      set value(v: CurveDef | null) {
        committedCurve = v;
      },
    },
    getCurve,
    getMorphDuration,
  );

  registerRenderOptionsEffect(() => instance, getOptions);

  return {
    get instance() {
      return instance;
    },
  };
}
