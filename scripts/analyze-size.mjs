#!/usr/bin/env node
/** @example node scripts/analyze-size.mjs */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "packages/sarmal/dist");
const esbuildBin = path.join(rootDir, "packages/sarmal/node_modules/.bin/esbuild");

// ── formatting helpers ────────────────────────────────────────────────────────

function bytesToHumanReadable(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function logSizeRow(name, raw, gzipped, indent = false) {
  const prefix = indent ? "  " : "";
  const rawStr =
    typeof raw === "number" ? bytesToHumanReadable(raw).padStart(10) : String(raw).padStart(10);
  const gzipStr =
    typeof gzipped === "number"
      ? bytesToHumanReadable(gzipped).padStart(10)
      : String(gzipped).padStart(10);
  console.log(`${prefix}${name.padEnd(35)} ${rawStr}  ${gzipStr}`);
}

const logSizeHeaderRow = (label = "Scenario / File") => logSizeRow(label, "Raw", "Gzipped");
const logSeparator = (char = "=") => console.log(char.repeat(62));

// ── file helpers ──────────────────────────────────────────────────────────────

function getFileSizeInfo(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = gzipSync(content);
  return { raw: content.length, gzipped: gzipped.length };
}

// ── tree-shaken measurement ───────────────────────────────────────────────────

if (!fs.existsSync(esbuildBin)) {
  console.error(
    `\n  ERROR: esbuild binary not found at:\n  ${esbuildBin}\n\n  Run \`pnpm install\` in packages/sarmal first.\n`,
  );
  process.exit(1);
}

/**
 * Bundle a tiny entry with esbuild (minified, tree-shaken) and return raw + gzipped byte counts.
 * The entry re-exports named exports from dist/index.js, forcing the tree-shaker to include them.
 */
function measureTreeShaken(namedExports) {
  const entry = `export { ${namedExports.join(", ")} } from ${JSON.stringify(path.join(distDir, "index.js"))};`;
  const tmpDir = os.tmpdir();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entryFile = path.join(tmpDir, `sarmal-entry-${stamp}.mjs`);
  const outFile = path.join(tmpDir, `sarmal-out-${stamp}.js`);

  try {
    fs.writeFileSync(entryFile, entry, "utf-8");
    execSync(
      `"${esbuildBin}" --bundle --minify --platform=browser --format=esm --outfile="${outFile}" "${entryFile}"`,
      { stdio: "pipe" },
    );
    return getFileSizeInfo(outFile);
  } finally {
    if (fs.existsSync(entryFile)) {
      fs.unlinkSync(entryFile);
    }
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile);
    }
  }
}

// ── sections ──────────────────────────────────────────────────────────────────

console.log("\n@sarmal/core Bundle Size Analysis");
logSeparator();

// ── 1. Tree-shaken scenarios ──────────────────────────────────────────────────

console.log("\nTree-shaken + minified  (what consumers actually ship)\n");
logSizeHeaderRow();
logSeparator("-");

const scenarios = [
  { label: "createEngine + rose3", exports: ["createEngine", "rose3"] },
  { label: "createSarmal + rose3", exports: ["createSarmal", "rose3"] },
  { label: "createSarmalSVG + rose3", exports: ["createSarmalSVG", "rose3"] },
  { label: "createSarmalDotMatrix + rose3", exports: ["createSarmalDotMatrix", "rose3"] },
  { label: "createSarmal + artemis2", exports: ["createSarmal", "artemis2"] },
  { label: "createSarmal + curves (all)", exports: ["createSarmal", "curves"] },
];

/** @type {Record<string, {raw: number, gzipped: number}>} */
const results = {};

for (const { label, exports } of scenarios) {
  const info = measureTreeShaken(exports);
  results[label] = info;
  logSizeRow(label, info.raw, info.gzipped, true);
}

// Delta between a drawn curve (artemis2) and a pure-math curve (rose3).
// With preserveModules output, catmull-rom is now properly opt-in: it is only
// included when artemis2 (or another drawn curve) is imported. The delta here
// represents the real cost of the catmull-rom module when using drawn curves.
const canvasRose3 = results["createSarmal + rose3"];
const canvasArtemis2 = results["createSarmal + artemis2"];
const drawnDeltaRaw = canvasArtemis2.raw - canvasRose3.raw;
const drawnDeltaGzipped = canvasArtemis2.gzipped - canvasRose3.gzipped;
const fmtDelta = (n) => (n >= 0 ? `+${bytesToHumanReadable(n)}` : bytesToHumanReadable(n));

logSeparator("-");
logSizeRow(
  "drawn curve delta (artemis2 vs rose3)",
  fmtDelta(drawnDeltaRaw),
  fmtDelta(drawnDeltaGzipped),
);

// ── 2. Update variables.ts size constants ────────────────────────────────────

// Canonical marketed size = canvas renderer + one pure-math curve, tree-shaken + gzipped.
const canonicalGzipKB = Number((canvasRose3.gzipped / 1024).toFixed(2));
const svgGzipKB = Number((results["createSarmalSVG + rose3"].gzipped / 1024).toFixed(2));
const dmGzipKB = Number((results["createSarmalDotMatrix + rose3"].gzipped / 1024).toFixed(2));
const engineGzipKB = Number((results["createEngine + rose3"].gzipped / 1024).toFixed(2));

// Renderer delta costs: cost of each renderer on top of the engine.
const canvasDeltaKB = Number(
  (
    (results["createSarmal + rose3"].gzipped - results["createEngine + rose3"].gzipped) /
    1024
  ).toFixed(2),
);
const svgDeltaKB = Number(
  (
    (results["createSarmalSVG + rose3"].gzipped - results["createEngine + rose3"].gzipped) /
    1024
  ).toFixed(2),
);
const dmDeltaKB = Number(
  (
    (results["createSarmalDotMatrix + rose3"].gzipped - results["createEngine + rose3"].gzipped) /
    1024
  ).toFixed(2),
);

// Derived constants.
const allCurvesGzipKB = Number((results["createSarmal + curves (all)"].gzipped / 1024).toFixed(2));
const diffKB = Number((allCurvesGzipKB - canonicalGzipKB).toFixed(2));
const enginePct = Math.round((engineGzipKB / canonicalGzipKB) * 100);

// Typical curve file size: rose3 gzip (the canonical example curve).
const rose3Info = getFileSizeInfo(path.join(distDir, "curves", "rose3.js"));
const curveTypicalSizeB = rose3Info.gzipped;

// Individual curve file sizes (for the per-module breakdown).
const curvesDir = path.join(distDir, "curves");
const curveFilesSorted = fs
  .readdirSync(curvesDir)
  .filter((f) => f.endsWith(".js") && !f.includes("index") && !f.endsWith(".map"))
  .sort();

const curveSizesEntries = curveFilesSorted.map((file) => {
  const info = getFileSizeInfo(path.join(curvesDir, file));
  return `  { name: "${file.replace(".js", "")}", bytes: ${info.gzipped} },`;
});

const curveSizesBlock = `// §CURVE_SIZES_START§
/** Individual curve file sizes (gzipped bytes). Auto-updated by scripts/analyze-size.mjs (DO NOT EDIT) */
export const CURVE_SIZES: Array<{ name: string; bytes: number }> = [
${curveSizesEntries.join("\n")}
];
// §CURVE_SIZES_END§`;

const variablesPath = path.join(rootDir, "docs/src/variables.ts");
let variablesContent = fs.readFileSync(variablesPath, "utf-8");

const autoInitRawKB = Number(
  (getFileSizeInfo(path.join(distDir, "auto-init.js")).raw / 1024).toFixed(2),
);

// Replace scalar constants.
const sizeReplacements = [
  [/export const PACKAGE_SIZE\s*=\s*[\d.]+/, `export const PACKAGE_SIZE = ${canonicalGzipKB}`],
  [/export const PACKAGE_SIZE_SVG\s*=\s*[\d.]+/, `export const PACKAGE_SIZE_SVG = ${svgGzipKB}`],
  [
    /export const PACKAGE_SIZE_DOTMATRIX\s*=\s*[\d.]+/,
    `export const PACKAGE_SIZE_DOTMATRIX = ${dmGzipKB}`,
  ],
  [
    /export const PACKAGE_SIZE_ENGINE\s*=\s*[\d.]+/,
    `export const PACKAGE_SIZE_ENGINE = ${engineGzipKB}`,
  ],
  [
    /export const PACKAGE_SIZE_ALL_CURVES\s*=\s*[\d.]+/,
    `export const PACKAGE_SIZE_ALL_CURVES = ${allCurvesGzipKB}`,
  ],
  [/export const PACKAGE_SIZE_DIFF\s*=\s*[\d.]+/, `export const PACKAGE_SIZE_DIFF = ${diffKB}`],
  [
    /export const PACKAGE_SIZE_ENGINE_PCT\s*=\s*[\d.]+/,
    `export const PACKAGE_SIZE_ENGINE_PCT = ${enginePct}`,
  ],
  [
    /export const PACKAGE_SIZE_AUTOINIT_KB\s*=\s*[\d.]+/,
    `export const PACKAGE_SIZE_AUTOINIT_KB = ${autoInitRawKB}`,
  ],
  [
    /export const RENDERER_DELTA_CANVAS_KB\s*=\s*[\d.]+/,
    `export const RENDERER_DELTA_CANVAS_KB = ${canvasDeltaKB}`,
  ],
  [
    /export const RENDERER_DELTA_SVG_KB\s*=\s*[\d.]+/,
    `export const RENDERER_DELTA_SVG_KB = ${svgDeltaKB}`,
  ],
  [
    /export const RENDERER_DELTA_DOTMATRIX_KB\s*=\s*[\d.]+/,
    `export const RENDERER_DELTA_DOTMATRIX_KB = ${dmDeltaKB}`,
  ],
  [
    /export const CURVE_TYPICAL_SIZE_B\s*=\s*[\d.]+/,
    `export const CURVE_TYPICAL_SIZE_B = ${curveTypicalSizeB}`,
  ],
];

for (const [pattern, replacement] of sizeReplacements) {
  variablesContent = variablesContent.replace(pattern, replacement);
}

// Replace the CURVE_SIZES block (delimited by §CURVE_SIZES_START§ / §CURVE_SIZES_END§).
variablesContent = variablesContent.replace(
  /\/\/ §CURVE_SIZES_START§[\s\S]*?\/\/ §CURVE_SIZES_END§/,
  curveSizesBlock,
);

fs.writeFileSync(variablesPath, variablesContent);
console.log(`\n  Updated variables.ts size constants:`);
console.log(`    PACKAGE_SIZE              = ${canonicalGzipKB} KB  (canvas + rose3)`);
console.log(`    PACKAGE_SIZE_ENGINE       = ${engineGzipKB} KB  (engine + rose3)`);
console.log(`    RENDERER_DELTA_CANVAS_KB  = +${canvasDeltaKB} KB`);
console.log(`    RENDERER_DELTA_SVG_KB     = +${svgDeltaKB} KB`);
console.log(`    RENDERER_DELTA_DOTMATRIX  = +${dmDeltaKB} KB`);
console.log(`    CURVE_TYPICAL_SIZE_B      = ${curveTypicalSizeB} B   (rose3 file, gzipped)`);
console.log(`    CURVE_SIZES               = ${curveSizesEntries.length} curves written\n`);

// ── 3. Pre-bundled dist files ─────────────────────────────────────────────────

console.log("Pre-bundled dist files  (before tree-shaking)\n");
logSizeHeaderRow("File");
logSeparator("-");

const mainBundle = getFileSizeInfo(path.join(distDir, "index.js"));
logSizeRow("index.js (ESM)", mainBundle.raw, mainBundle.gzipped, true);

const mainBundleCjs = getFileSizeInfo(path.join(distDir, "index.cjs"));
logSizeRow("index.cjs (CJS)", mainBundleCjs.raw, mainBundleCjs.gzipped, true);

const autoInit = getFileSizeInfo(path.join(distDir, "auto-init.js"));
logSizeRow("auto-init.js (CDN only)", autoInit.raw, autoInit.gzipped, true);

// ── 4. Individual curve deep imports ─────────────────────────────────────────

console.log("\nIndividual curve files  (@sarmal/core/curves/<name>)\n");
logSizeHeaderRow("Curve");
logSeparator("-");

let totalCurveRaw = 0;
let totalCurveGzipped = 0;

for (const file of curveFilesSorted) {
  const info = getFileSizeInfo(path.join(curvesDir, file));
  totalCurveRaw += info.raw;
  totalCurveGzipped += info.gzipped;
  logSizeRow(file.replace(".js", ""), info.raw, info.gzipped, true);
}

logSeparator("-");
logSizeRow("Total", totalCurveRaw, totalCurveGzipped, true);

// ── 5. Summary ────────────────────────────────────────────────────────────────

console.log("\n");
logSeparator();
console.log("Summary  (tree-shaken, minified, gzipped)\n");
console.log(`  Canvas renderer + 1 curve:      ${bytesToHumanReadable(canvasRose3.gzipped)}`);
console.log(
  `  SVG renderer + 1 curve:         ${bytesToHumanReadable(results["createSarmalSVG + rose3"].gzipped)}`,
);
console.log(
  `  Dot-matrix renderer + 1 curve:  ${bytesToHumanReadable(results["createSarmalDotMatrix + rose3"].gzipped)}`,
);
console.log(
  `  Engine only + 1 curve:          ${bytesToHumanReadable(results["createEngine + rose3"].gzipped)}`,
);
console.log(
  `  Catmull-rom in every bundle:    no  (opt-in — only included when a drawn curve is used)`,
);
console.log(
  `  All curves (no tree-shake):     ${bytesToHumanReadable(results["createSarmal + curves (all)"].gzipped)}`,
);
logSeparator();
