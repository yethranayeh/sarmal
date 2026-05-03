import type { PlaygroundState } from "./playgroundState.svelte";
import type { DrawingSegment } from "./types";

import { createSarmal, curves, drawCurve, palettes, computeBoundaries } from "@sarmal/core";
import type { Point, CurveDef, SarmalOptions } from "@sarmal/core";
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

const WEBM_MIN_DURATION = 1;
const WEBM_MAX_DURATION = 8;
const WEBM_FPS = 60;

export function resolveWebMCurve(pg: PlaygroundState): CurveDef {
  if (pg.currentMode === "draw") {
    const pts = pg.drawBoardRef?.getPoints();
    if (!pts || pts.length < 3) {
      throw new Error("Draw mode requires at least 3 points");
    }
    return { ...drawCurve(pts), speed: pg.speed };
  }

  if (pg.presetId) {
    const preset = curves[pg.presetId as keyof typeof curves];
    if (!preset) {
      throw new Error(`Preset "${pg.presetId}" not found`);
    }
    return { ...preset, speed: pg.speed };
  }

  if (!pg.lastCompiledFn) {
    throw new Error("No compiled curve");
  }

  return {
    name: "custom",
    fn: pg.lastCompiledFn,
    period: 2 * Math.PI,
    speed: pg.speed,
  };
}

export function resolveWebMOptions(pg: PlaygroundState): SarmalOptions {
  const opts: SarmalOptions = {
    trailColor: pg.resolvedTrailColor,
    skeletonColor: pg.resolvedSkeletonColor,
    trailStyle: pg.trailStyle,
    trailLength: pg.trailLength,
    autoStart: true,
  };

  if (!pg.headColorAuto) {
    opts.headColor = pg.headColor;
  }

  if (pg.headRadius !== null) {
    opts.headRadius = pg.headRadius;
  }

  return opts;
}

function getWebMPeriod(pg: PlaygroundState): number {
  if (pg.currentMode === "draw") {
    return 2 * Math.PI;
  }

  if (pg.presetId) {
    const preset = curves[pg.presetId as keyof typeof curves];
    return preset?.period ?? 2 * Math.PI;
  }

  return 2 * Math.PI;
}

export function getWebMDurationSeconds(pg: PlaygroundState): number {
  const period = getWebMPeriod(pg);
  const raw = period / pg.speed;
  return Math.max(WEBM_MIN_DURATION, Math.min(WEBM_MAX_DURATION, raw));
}

export function getWebMRawDurationSeconds(pg: PlaygroundState): number {
  return getWebMPeriod(pg) / pg.speed;
}

export async function recordWebM(
  pg: PlaygroundState,
  durationSeconds: number,
  signal?: AbortSignal,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const clamped = Math.max(WEBM_MIN_DURATION, Math.min(WEBM_MAX_DURATION, durationSeconds));

  const curve = resolveWebMCurve(pg);
  const options = resolveWebMOptions(pg);

  const previewRect = pg.previewRef.current?.getBoundingClientRect();
  const containerSize =
    previewRect && previewRect.width > 0 && previewRect.height > 0
      ? Math.max(previewRect.width, previewRect.height)
      : 400;

  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  const style = canvas.style;
  style.position = "fixed";
  style.left = "-9999px";
  style.top = "-9999px";
  style.visibility = "hidden";
  style.width = `${containerSize}px`;
  style.height = `${containerSize}px`;
  document.body.appendChild(canvas);

  canvas.width = containerSize * dpr;
  canvas.height = containerSize * dpr;

  const bgColor =
    getComputedStyle(document.documentElement).getPropertyValue("--color-background").trim() ||
    "#131311";

  const ctx = canvas.getContext("2d")!;
  const origClearRect = ctx.clearRect.bind(ctx);
  ctx.clearRect = (x: number, y: number, w: number, h: number) => {
    origClearRect(x, y, w, h);
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
  };

  let instance: ReturnType<typeof createSarmal> | null = null;

  const abortHandler = () => {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  };

  let recorder: MediaRecorder | null = null;

  try {
    instance = createSarmal(canvas, curve, options);

    const stream = canvas.captureStream(WEBM_FPS);

    const codec = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    recorder = new MediaRecorder(stream, { mimeType: codec });

    signal?.addEventListener("abort", abortHandler);

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    let stopTimeout: ReturnType<typeof setTimeout> | null = null;

    const blob = await new Promise<Blob>((resolve, reject) => {
      const startTime = performance.now();
      const totalMs = clamped * 1000;

      const cleanup = () => {
        if (progressInterval !== null) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        if (stopTimeout !== null) {
          clearTimeout(stopTimeout);
          stopTimeout = null;
        }
      };

      recorder!.onstop = () => {
        cleanup();
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        resolve(new Blob(chunks, { type: "video/webm" }));
      };

      recorder!.onerror = () => {
        cleanup();
        reject(new Error("MediaRecorder error"));
      };

      recorder!.start();

      progressInterval = setInterval(() => {
        if (signal?.aborted) {
          clearInterval(progressInterval!);
          progressInterval = null;
          return;
        }
        const elapsed = (performance.now() - startTime) / totalMs;
        onProgress?.(Math.min(elapsed, 1));
      }, 100);

      stopTimeout = setTimeout(() => {
        clearInterval(progressInterval!);
        progressInterval = null;
        if (recorder && recorder.state === "recording") {
          recorder.stop();
        }
      }, totalMs);
    });

    return blob;
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    instance?.destroy();
    document.body.removeChild(canvas);
  }
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
  clone.querySelectorAll("[data-export-hidden]").forEach((el) => el.remove());
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

const SVG_VIEWBOX = "-1 -1 2 2";
const SVG_STROKE_WIDTH = "0.02";

function skeletonToViewBox(skeleton: Point[]): Point[] {
  const bounds = computeBoundaries(skeleton, 2, 2, 0);
  if (!bounds) return [];

  const { scale, offsetX, offsetY } = bounds;
  return skeleton.map((p) => ({
    x: p.x * scale + offsetX - 1,
    y: p.y * scale + offsetY - 1,
  }));
}

export function generateSVGString(pg: PlaygroundState): string {
  const skeleton =
    pg.currentMode === "draw" ? pg.drawBoardRef?.getSkeleton() : pg.instance?.getSarmalSkeleton();
  if (!skeleton || skeleton.length === 0) {
    throw new Error("Preview not ready");
  }

  let normalized: Point[];
  try {
    normalized = skeletonToViewBox(skeleton);
  } catch {
    normalized = skeleton;
  }

  const d =
    normalized
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(4)} ${p.y.toFixed(4)}`)
      .join(" ") + " Z";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SVG_VIEWBOX}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${SVG_STROKE_WIDTH}"/></svg>`;
}

export function downloadSVG(pg: PlaygroundState): void {
  const svgString = generateSVGString(pg);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sarmal.svg";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
