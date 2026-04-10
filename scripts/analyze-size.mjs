#!/usr/bin/env node
/** @example node scripts/analyze-size.mjs */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "../packages/sarmal/dist");

function getFileSizeInfo(filePath) {
  const content = fs.readFileSync(filePath);
  const gzipped = gzipSync(content);
  return {
    raw: content.length,
    gzipped: gzipped.length,
  };
}

function bytesToHumanReadable(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function logSizeRow(name, raw, gzipped, indent = false) {
  const prefix = indent ? "  " : "";
  const rawStr = typeof raw === "number" ? bytesToHumanReadable(raw).padStart(10) : raw.padStart(10);
  const gzipStr = typeof gzipped === "number" ? bytesToHumanReadable(gzipped).padStart(10) : gzipped.padStart(10);
  console.log(`${prefix}${name.padEnd(30)} ${rawStr}  ${gzipStr}`);
}

const logSizeHeaderRow = () => logSizeRow("File", "Raw", "Gzipped");
const logSeparator = (char = "=") => console.log(char.repeat(55));

console.log("@sarmal/core Bundle Size Analysis");
logSeparator()

// Main bundle
console.log("\n(core)\n");
logSizeHeaderRow()
logSeparator("-")

const mainBundle = getFileSizeInfo(path.join(distDir, "index.js"));
logSizeRow("index.js (ESM)", mainBundle.raw, mainBundle.gzipped);

// Update PACKAGE_SIZE in docs/src/variables.ts with gzipped KB
const sizeInKB = Number((mainBundle.gzipped / 1024).toFixed(2));
const variablesPath = path.join(__dirname, "../docs/src/variables.ts");
const variablesContent = fs.readFileSync(variablesPath, "utf-8");
const updatedVariables = variablesContent.replace(
  /export const PACKAGE_SIZE\s*=\s*[\d.]+/,
  `export const PACKAGE_SIZE = ${sizeInKB}`
);
fs.writeFileSync(variablesPath, updatedVariables);
console.log(`\n  Updated PACKAGE_SIZE in docs/src/variables.ts: ${sizeInKB} KB`);

const mainBundleCjs = getFileSizeInfo(path.join(distDir, "index.cjs"));
logSizeRow("index.cjs (CJS)", mainBundleCjs.raw, mainBundleCjs.gzipped);

// auto-init
console.log("\n(auto-init)\n");
logSizeHeaderRow()
logSeparator("-")

const autoInit = getFileSizeInfo(path.join(distDir, "auto-init.js"));
logSizeRow("auto-init.js", autoInit.raw, autoInit.gzipped);

// Individual curves
console.log("\nCurves (ESM, gzipped)\n");
const curvesDir = path.join(distDir, "curves");
const curveFiles = fs
  .readdirSync(curvesDir)
  .filter((f) => f.endsWith(".js") && !f.includes("index") && !f.endsWith(".map"))
  .sort();

logSizeRow("Curve", "Raw", "Gzipped");
logSeparator("-")

let totalCurveRaw = 0;
let totalCurveGzipped = 0;

for (const file of curveFiles) {
  const info = getFileSizeInfo(path.join(curvesDir, file));
  totalCurveRaw += info.raw;
  totalCurveGzipped += info.gzipped;
  logSizeRow(file.replace(".js", ""), info.raw, info.gzipped, true);
}

logSeparator("-")
logSizeRow("Total", totalCurveRaw, totalCurveGzipped, true);

// Curves index
console.log("\nCurves [index.ts]\n");
logSizeHeaderRow()
logSeparator("-")

const curvesIndex = getFileSizeInfo(path.join(distDir, "curves/index.js"));
logSizeRow("curves/index.js", curvesIndex.raw, curvesIndex.gzipped);

// Summary
console.log("\n");
logSeparator()
console.log("Summary\n");
console.log(`  Core bundle (gzipped):      ${bytesToHumanReadable(mainBundle.gzipped)}`);
console.log(`  Auto-init (gzipped):        ${bytesToHumanReadable(autoInit.gzipped)}`);
console.log(`  Single curve (avg gzipped): ${bytesToHumanReadable(Math.round(totalCurveGzipped / curveFiles.length))}`);
console.log(`  All curves (gzipped):       ${bytesToHumanReadable(totalCurveGzipped)}`);
logSeparator()
