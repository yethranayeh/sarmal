import type { PlaygroundState } from "../playgroundState.svelte";
import type { Point } from "@sarmal/core";

import { computeBoundaries } from "@sarmal/core";

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
