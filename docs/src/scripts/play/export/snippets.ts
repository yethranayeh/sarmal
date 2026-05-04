import type { PlaygroundState } from "../playgroundState.svelte";

import {
  serializeCurveRef,
  serializeOptions,
  serializeReactOptions,
  serializeReactInit,
  needsPalettesImport,
  VERSION,
} from "./serialize";

export function generateJSSnippet(pg: PlaygroundState): string {
  const { ref: curveRef, imports: curveImports } = serializeCurveRef(pg);
  const opts = serializeOptions(pg);

  const allImports = ["createSarmal", ...curveImports];
  if (needsPalettesImport(pg)) {
    allImports.push("palettes");
  }
  const importLine = `import { ${allImports.join(", ")} } from '@sarmal/core'`;

  const lines = [importLine, "", `const curve = ${curveRef}`];

  if (pg.speed !== 1) {
    lines.push(`curve.speed = ${pg.speed}`);
  }

  if (opts) {
    lines.push(`createSarmal(document.querySelector('canvas'), curve, ${opts})`);
  } else {
    lines.push("createSarmal(document.querySelector('canvas'), curve)");
  }

  return lines.join("\n");
}

export function generateReactSnippet(pg: PlaygroundState): string {
  const { ref: curveRef, imports: curveImports } = serializeCurveRef(pg);
  const opts = serializeReactOptions(pg);
  const init = serializeReactInit(pg);

  const lines: string[] = [];

  lines.push("import { useSarmalSVG } from '@sarmal/react'");

  const coreImports = [...curveImports];
  if (needsPalettesImport(pg)) {
    coreImports.push("palettes");
  }
  if (coreImports.length > 0) {
    lines.push(`import { ${coreImports.join(", ")} } from '@sarmal/core'`);
  }

  lines.push("");
  lines.push("export function SarmalCurve() {");

  lines.push(`  const curve = ${curveRef}`);

  if (pg.speed !== 1) {
    lines.push(`  curve.speed = ${pg.speed}`);
  }

  const args: string[] = ["curve"];
  if (opts) args.push(opts);
  else if (init) args.push("undefined");
  if (init) args.push(init);

  lines.push(`  const { svgRef } = useSarmalSVG(${args.join(", ")})`);
  lines.push("  return <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />");
  lines.push("}");

  return lines.join("\n");
}

export function generateStandaloneHTML(pg: PlaygroundState): string {
  const { ref: curveRef, imports: curveImports } = serializeCurveRef(pg);
  const opts = serializeOptions(pg);

  const allImports = ["createSarmal", ...curveImports];
  if (needsPalettesImport(pg)) {
    allImports.push("palettes");
  }
  const cdnBase = `https://cdn.jsdelivr.net/npm/@sarmal/core@${VERSION}/+esm`;

  const jsLines = [
    `import { ${allImports.join(", ")} } from '${cdnBase}'`,
    "",
    `const curve = ${curveRef}`,
  ];

  if (pg.speed !== 1) {
    jsLines.push(`curve.speed = ${pg.speed}`);
  }

  if (opts) {
    jsLines.push(`createSarmal(document.getElementById('c'), curve, ${opts})`);
  } else {
    jsLines.push("createSarmal(document.getElementById('c'), curve)");
  }

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>Sarmal</title>",
    "<style>",
    "*,*::after,*::before{box-sizing:border-box}",
    "body{margin:0;background:#0d0d0d;display:flex;align-items:center;justify-content:center;min-height:100dvh}",
    "canvas{width:min(80vw,80dvh);height:min(80vw,80dvh);aspect-ratio:1}",
    "</style>",
    "</head>",
    "<body>",
    '<canvas id="c"></canvas>',
    '<script type="module">',
    jsLines.join("\n"),
    "</script>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
