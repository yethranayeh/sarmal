export const SEPARATOR_DOT = "·";

// ── Bundle sizes (KB, gzipped) ────────────────────────────────────────────────
// All values are tree-shaken + minified + gzipped.
// Auto-updated by scripts/analyze-size.mjs

/** Canvas renderer + one curve */
export const PACKAGE_SIZE = 5.69;
/** SVG renderer + one curve */
export const PACKAGE_SIZE_SVG = 6.12;
/** Dot-matrix renderer + one curve */
export const PACKAGE_SIZE_DOTMATRIX = 5.72;
/** Engine only (math, no rendering) + one curve */
export const PACKAGE_SIZE_ENGINE = 1.47;
/** createSarmal + the full `curves` object (all 14 curves, no per-curve tree-shaking) */
export const PACKAGE_SIZE_ALL_CURVES = 6.87;
/** Additional cost of all curves vs one curve (KB, gzipped). Auto-updated by scripts/analyze-size.mjs */
export const PACKAGE_SIZE_DIFF = 1.18;
/** Engine-only size as percentage of full canvas renderer bundle. Auto-updated by scripts/analyze-size.mjs */
export const PACKAGE_SIZE_ENGINE_PCT = 26;
/** CDN auto-init bundle — raw, unminified (KB). Not for use inside a bundled app. */
export const PACKAGE_SIZE_AUTOINIT_KB = 92.65;

// ── Renderer delta costs (KB, gzipped) ───────────────────────────────────────
// These are the costs of adding each renderer on top of the engine.
// Auto-updated by scripts/analyze-size.mjs

/** Additional cost of the canvas renderer over engine-only */
export const RENDERER_DELTA_CANVAS_KB = 4.22;
/** Additional cost of the SVG renderer over engine-only */
export const RENDERER_DELTA_SVG_KB = 4.65;
/** Additional cost of the dot-matrix renderer over engine-only */
export const RENDERER_DELTA_DOTMATRIX_KB = 4.25;

// ── Curve stats ───────────────────────────────────────────────────────────────

/** Typical individual curve file size in bytes, gzipped (rose3 — the canonical example). Auto-updated by analyze-size.mjs */
export const CURVE_TYPICAL_SIZE_B = 300;
/** Number of built-in curves */
export const CURVE_COUNT = 14;

// §CURVE_SIZES_START§
/** Individual curve file sizes (gzipped bytes). Auto-updated by scripts/analyze-size.mjs (DO NOT EDIT) */
export const CURVE_SIZES: Array<{ name: string; bytes: number }> = [
  { name: "artemis2", bytes: 309 },
  { name: "astroid", bytes: 315 },
  { name: "deltoid", bytes: 308 },
  { name: "epicycloid3", bytes: 303 },
  { name: "epitrochoid7", bytes: 378 },
  { name: "lame", bytes: 386 },
  { name: "lissajous32", bytes: 337 },
  { name: "lissajous43", bytes: 340 },
  { name: "rose3", bytes: 300 },
  { name: "rose5", bytes: 297 },
  { name: "rose52", bytes: 358 },
  { name: "star", bytes: 312 },
  { name: "star4", bytes: 368 },
  { name: "star7", bytes: 374 },
];
// §CURVE_SIZES_END§

// ── Dependencies ──────────────────────────────────────────────────────────────

/** Runtime dependency count */
export const RUNTIME_DEPENDENCIES = 0;
