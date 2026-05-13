import type { CurveDef, SarmalInstance, SarmalOptions } from "@sarmal/core";
import type { Init } from "./types";

import { untrack } from "svelte";
import { createSarmalSVG } from "@sarmal/core";

import { initValuesEqual } from "./utils";
import { registerMorphEffect, registerRenderOptionsEffect } from "./use-morph-and-render.svelte";

export function useSarmalSVG(
  svgElement: SVGSVGElement | null,
  getCurve: () => CurveDef,
  getOptions?: () => Partial<SarmalOptions>,
  getInit?: () => Init,
  getMorphDuration?: () => number | undefined,
): {
  get instance(): SarmalInstance | null;
} {
  let instance = $state<SarmalInstance | null>(null);
  let committedCurve: CurveDef | null = null;
  let prevInit: Init | undefined;

  $effect(() => {
    const init = getInit?.();
    const s = svgElement;
    if (!s) {
      return;
    }

    if (prevInit && initValuesEqual(prevInit, init)) {
      return;
    }
    prevInit = init;

    instance?.destroy();

    const initCurve = untrack(() => getCurve());
    const initRuntimeOpts = untrack(() => getOptions?.());

    const inst = createSarmalSVG(s, initCurve, {
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
