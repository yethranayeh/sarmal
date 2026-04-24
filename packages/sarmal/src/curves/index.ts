// Individual curve exports for tree-shaking
export { artemis2 } from "./artemis2";
export { astroid } from "./astroid";
export { deltoid } from "./deltoid";
export { epicycloid3 } from "./epicycloid3";
export { epitrochoid7 } from "./epitrochoid7";
export { lissajous32 } from "./lissajous32";
export { lissajous43 } from "./lissajous43";
export { lame } from "./lame";
export { rose3 } from "./rose3";
export { rose5 } from "./rose5";
export { rose52 } from "./rose52";
export { star } from "./star";
export { star4 } from "./star4";
export { star7 } from "./star7";

// Bulk export for convenience
// >> Standard
import { rose3 } from "./rose3";
import { rose5 } from "./rose5";
import { rose52 } from "./rose52";
import { star } from "./star";
import { star4 } from "./star4";
import { star7 } from "./star7";
import { astroid } from "./astroid";
import { deltoid } from "./deltoid";
import { epicycloid3 } from "./epicycloid3";
import { epitrochoid7 } from "./epitrochoid7";
import { lissajous32 } from "./lissajous32";
import { lissajous43 } from "./lissajous43";
import { lame } from "./lame";
// >> Iconic
import { artemis2 } from "./artemis2";

/**
 * Collection of all built-in sarmal curves
 * Import individual curves for better tree-shaking
 */
export const curves = {
  artemis2,
  epitrochoid7,
  astroid,
  deltoid,
  rose3,
  rose5,
  rose52,
  star,
  star4,
  star7,
  lissajous32,
  lissajous43,
  epicycloid3,
  lame,
} as const;
export type CurveName = keyof typeof curves;
