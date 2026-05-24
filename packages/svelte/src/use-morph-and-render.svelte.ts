import type { CurveDef, MorphStrategy, SarmalInstance, SarmalOptions } from "@sarmal/core";

import { extractRuntimeOptions } from "./utils";

export function registerMorphEffect(
  getInstance: () => SarmalInstance | null,
  committedCurve: { value: CurveDef | null },
  getCurve: () => CurveDef,
  getMorphDuration?: () => number | undefined,
  getMorphStrategy?: () => MorphStrategy | undefined,
) {
  $effect(() => {
    const curve = getCurve();
    if (!committedCurve.value) {
      return;
    }

    if (curve === committedCurve.value) {
      return;
    }

    committedCurve.value = curve;
    const dur = getMorphDuration?.();
    const strategy = getMorphStrategy?.();
    getInstance()
      ?.morphTo(curve, {
        ...(dur != null && { duration: dur }),
        ...(strategy != null && { morphStrategy: strategy }),
      })
      .catch(() => {});
  });
}

export function registerRenderOptionsEffect(
  getInstance: () => SarmalInstance | null,
  getOptions?: () => Partial<SarmalOptions> | undefined,
) {
  $effect(() => {
    const opts = getOptions?.();
    const inst = getInstance();
    if (!inst || !opts) {
      return;
    }

    const runtime = extractRuntimeOptions(opts);
    if (Object.keys(runtime).length > 0) {
      inst.setRenderOptions(runtime);
    }
  });
}
