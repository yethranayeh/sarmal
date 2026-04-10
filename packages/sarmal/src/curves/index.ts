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

// Bulk export for convenience
import type { CurveDef } from "../types";
import { artemis2 } from "./artemis2";
import { astroid } from "./astroid";
import { deltoid } from "./deltoid";
import { epicycloid3 } from "./epicycloid3";
import { epitrochoid7 } from "./epitrochoid7";
import { lissajous32 } from "./lissajous32";
import { lissajous43 } from "./lissajous43";
import { lame } from "./lame";
import { rose3 } from "./rose3";
import { rose5 } from "./rose5";

/**
 * Collection of all built-in sarmal curves
 * Import individual curves for better tree-shaking
 */
export const curves: Record<string, CurveDef> = {
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
};
