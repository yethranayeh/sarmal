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
  TrailColor,
  RuntimeRenderOptions,
} from "./types";
export type { CurveName } from "./curves";
export type { SarmalPalette } from "./renderer-shared";

export { createEngine } from "./engine";
export { createRenderer } from "./renderer";
export { createSVGRenderer, createSarmalSVG } from "./renderer-svg";
export { curves } from "./curves";
export { palettes } from "./renderer-shared";
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
 * import { createSarmal, rose3 } from '@sarmal/core'
 * const sarmal = createSarmal(canvas, rose3)
 *
 * // To control manually, use autoStart: false
 * const controlled = createSarmal(canvas, rose3, { autoStart: false })
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
