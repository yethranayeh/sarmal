import type {
  CurveDef,
  MorphStrategy,
  SarmalInstance,
  DotMatrixSarmalOptions,
  DotMatrixRuntimeRenderOptions,
  DotMatrixInit,
} from "@sarmal/core";

import { untrack } from "svelte";
import { createSarmalDotMatrix } from "@sarmal/core";

import { dotMatrixInitValuesEqual, resolveCanvasSize } from "./utils";
import { registerMorphEffect } from "./use-morph-and-render.svelte";

export function useSarmalDotMatrix(
  canvasElement: HTMLCanvasElement | null,
  getCurve: () => CurveDef,
  getOptions?: () => Partial<DotMatrixSarmalOptions>,
  getInit?: () => DotMatrixInit,
  getMorphDuration?: () => number | undefined,
  getMorphStrategy?: () => MorphStrategy | undefined,
): {
  get instance(): SarmalInstance<DotMatrixRuntimeRenderOptions> | null;
} {
  let instance = $state<SarmalInstance<DotMatrixRuntimeRenderOptions> | null>(null);
  let committedCurve: CurveDef | null = null;
  let prevInit: DotMatrixInit | undefined;

  $effect(() => {
    const init = getInit?.();
    const c = canvasElement;
    if (!c) {
      return;
    }

    if (prevInit && dotMatrixInitValuesEqual(prevInit, init)) {
      return;
    }
    prevInit = init;

    const initCurve = untrack(() => getCurve());
    const initRuntimeOpts = untrack(() => getOptions?.());

    const { width: w, height: h } = resolveCanvasSize(c, init?.width, init?.height);
    c.width = w;
    c.height = h;

    const inst = createSarmalDotMatrix(c, initCurve, {
      ...initRuntimeOpts,
      ...(init?.cols !== undefined && { cols: init.cols }),
      ...(init?.rows !== undefined && { rows: init.rows }),
      ...(init?.roundness !== undefined && { roundness: init.roundness }),
      ...(init?.trailLength !== undefined && { trailLength: init.trailLength }),
      ...(init?.autoStart !== undefined && { autoStart: init.autoStart }),
      ...(init?.initialPhase !== undefined && { initialPhase: init.initialPhase }),
      ...(init?.pauseOnHidden !== undefined && { pauseOnHidden: init.pauseOnHidden }),
    });

    instance = inst;
    committedCurve = initCurve;

    return () => {
      inst.destroy();
      instance = null;
      committedCurve = null;
    };
  });

  // registerMorphEffect only calls morphTo which is identical across all SarmalInstance<T>
  registerMorphEffect(
    () => instance as SarmalInstance | null,
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
    getMorphStrategy,
  );

  // Inline render options effect: dot matrix only supports trailColor, trailStyle, skeletonColor
  $effect(() => {
    const opts = getOptions?.();
    const inst = instance;
    if (!inst || !opts) {
      return;
    }

    const runtime: Partial<DotMatrixRuntimeRenderOptions> = {};
    if (opts.trailColor !== undefined) {
      runtime.trailColor = opts.trailColor;
    }

    if (opts.skeletonColor !== undefined) {
      runtime.skeletonColor = opts.skeletonColor;
    }

    if (opts.trailStyle !== undefined) {
      runtime.trailStyle = opts.trailStyle;
    }

    if (Object.keys(runtime).length > 0) {
      inst.setRenderOptions(runtime);
    }
  });

  return {
    get instance() {
      return instance;
    },
  };
}
