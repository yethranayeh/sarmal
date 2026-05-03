import type { PlaygroundState } from "./playgroundState.svelte";
import type { DrawingSegment } from "./types";

import { palettes } from "@sarmal/core";
import { getResolvedSkeletonColor } from "./renderer";
import pkg from "../../../../packages/sarmal/package.json";

const VERSION = pkg.version;
/** Matches the default `trailLength` in playground state — see `playgroundState.svelte.ts:79` */
const DEFAULT_ENGINE_TRAIL_LENGTH = 120;

function pointsToString(points: Array<DrawingSegment>): string {
  const lines = points.map(([x, y]) => `  [${x.toFixed(2)}, ${y.toFixed(2)}]`);
  return `[\n${lines.join(",\n")},\n]`;
}

function formatTrailColor(pg: PlaygroundState): string {
  if (pg.trailStyle !== "default") {
    const p = palettes[pg.palette];
    if (p) {
      return `palettes.${pg.palette}`;
    }
    console.warn(
      `[export] Palette "${pg.palette}" not found — falling back to trailColor for export.`,
    );
  }
  return `'${pg.trailColor}'`;
}

function needsPalettesImport(pg: PlaygroundState): boolean {
  return pg.trailStyle !== "default" && !!palettes[pg.palette];
}

function serializeCurveRef(pg: PlaygroundState): { ref: string; imports: string[] } {
  if (pg.currentMode === "draw") {
    const points = pg.drawPoints;
    return {
      ref: `drawCurve(${pointsToString(points)})`,
      imports: ["drawCurve"],
    };
  }

  if (pg.presetId) {
    const id = pg.presetId;
    const safeRef = id.includes(".") ? `curves['${id}']` : `curves.${id}`;
    return { ref: safeRef, imports: ["curves"] };
  }

  const body = pg.lastCompiledCode.trim();
  const indented = body
    .split("\n")
    .map((line) => (line ? `    ${line}` : ""))
    .join("\n");
  return {
    ref: `{\n  name: 'custom',\n  fn: (t, time, params) => {\n${indented}\n  },\n}`,
    imports: [],
  };
}

function serializeSharedColorOptions(pg: PlaygroundState): string[] {
  const parts: string[] = [];

  if (pg.trailStyle !== "default") {
    parts.push(`trailStyle: '${pg.trailStyle}'`);
  }

  parts.push(`trailColor: ${formatTrailColor(pg)}`);

  if (pg.showSkeleton) {
    const resolvedSkeleton = getResolvedSkeletonColor(
      pg.showSkeleton,
      pg.trailStyle,
      pg.palette,
      pg.trailColor,
    );
    parts.push(`skeletonColor: '${resolvedSkeleton}'`);
  }

  if (!pg.headColorAuto) {
    parts.push(`headColor: '${pg.headColor}'`);
  }

  return parts;
}

function serializeOptions(pg: PlaygroundState): string | null {
  const parts = serializeSharedColorOptions(pg);

  if (pg.headRadius !== null) {
    parts.push(`headRadius: ${pg.headRadius}`);
  }

  if (pg.trailLength !== DEFAULT_ENGINE_TRAIL_LENGTH) {
    parts.push(`trailLength: ${pg.trailLength}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

function serializeReactOptions(pg: PlaygroundState): string | null {
  const parts = serializeSharedColorOptions(pg);

  if (pg.headRadius !== null) {
    parts.push(`headRadius: ${pg.headRadius}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

function serializeReactInit(pg: PlaygroundState): string | null {
  const parts: string[] = [];

  if (pg.trailLength !== DEFAULT_ENGINE_TRAIL_LENGTH) {
    parts.push(`trailLength: ${pg.trailLength}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

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

export async function downloadPNG(svgEl: SVGSVGElement): Promise<void> {
  const rect = svgEl.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error("Preview not ready");
  }

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  const dpr = window.devicePixelRatio || 1;
  const w = rect.width * dpr;
  const h = rect.height * dpr;

  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to create canvas context"));
        return;
      }
      ctx.scale(dpr, dpr);
      // TODO: derive from design tokens instead of hardcoding when available
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create PNG"));
          return;
        }
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "sarmal.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        resolve();
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG"));
    };
    img.src = url;
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
