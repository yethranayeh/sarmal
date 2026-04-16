import type { CurveDef, SarmalInstance, SarmalOptions } from "./types";
export type { SVGRendererOptions, SVGSarmalOptions } from "./renderer-svg";
export type {
  BaseRendererOptions,
  Point,
  CurveDef,
  Engine,
  SarmalInstance,
  JumpOptions,
  SeekOptions,
  RendererOptions,
  SarmalOptions,
  TrailStyle,
  PalettePreset,
} from "./types";
export type { CurveName } from "./curves";

export { createEngine } from "./engine";
export { createRenderer } from "./renderer";
export { createSVGRenderer, createSarmalSVG } from "./renderer-svg";
export { curves } from "./curves";
export {
  artemis2,
  epitrochoid7,
  astroid,
  deltoid,
  rose5,
  rose3,
  lissajous32,
  lissajous43,
  epicycloid3,
  lame,
} from "./curves";

import { createEngine } from "./engine";
import { createRenderer } from "./renderer";

/**
 * Creates a sarmal animation on a canvas element
 *
 * @example
 * ```ts
 * import { createSarmal, curves } from '@sarmal/core'
 * const sarmal = createSarmal(canvas, curves.artemis2)
 *
 * // To control manually, use autoStart: false
 * const controlled = createSarmal(canvas, curves.artemis2, { autoStart: false })
 * controlled.play()  // Start when ready
 * controlled.pause() // Pause later
 * ```
 */
export function createSarmal(
  canvas: HTMLCanvasElement,
  curveDef: CurveDef,
  options?: SarmalOptions,
): SarmalInstance {
  const { trailLength, ...rendererOpts } = options ?? {};
  const engine = createEngine(curveDef, trailLength);

  return createRenderer({ canvas, engine, ...rendererOpts });
}
