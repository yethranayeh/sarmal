import type { PlaygroundState } from "../playgroundState.svelte";
import type { DrawingSegment } from "../types";

import { drawCurve, palettes } from "@sarmal/core";
import { getResolvedSkeletonColor } from "../renderer";
import pkg from "../../../../../packages/sarmal/package.json";

export const VERSION = pkg.version;
export const DEFAULT_ENGINE_TRAIL_LENGTH = 120;

export function pointsToString(points: Array<DrawingSegment>): string {
  const lines = points.map(([x, y]) => `  [${x.toFixed(2)}, ${y.toFixed(2)}]`);
  return `[\n${lines.join(",\n")},\n]`;
}

export function formatTrailColor(pg: PlaygroundState): string {
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

export function needsPalettesImport(pg: PlaygroundState): boolean {
  return pg.trailStyle !== "default" && !!palettes[pg.palette];
}

export function serializeCurveRef(pg: PlaygroundState): { ref: string; imports: string[] } {
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

export function serializeSharedColorOptions(pg: PlaygroundState): string[] {
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

export function serializeOptions(pg: PlaygroundState): string | null {
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

export function serializeReactOptions(pg: PlaygroundState): string | null {
  const parts = serializeSharedColorOptions(pg);

  if (pg.headRadius !== null) {
    parts.push(`headRadius: ${pg.headRadius}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

export function serializeReactInit(pg: PlaygroundState): string | null {
  const parts: string[] = [];

  if (pg.trailLength !== DEFAULT_ENGINE_TRAIL_LENGTH) {
    parts.push(`trailLength: ${pg.trailLength}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}
