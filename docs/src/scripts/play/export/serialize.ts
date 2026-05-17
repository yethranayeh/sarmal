import type { PlaygroundState } from "../playgroundState.svelte";
import type { DrawingSegment } from "../types";
import type { SarmalOptions } from "@sarmal/core";

import { palettes } from "@sarmal/core";

import pkg from "../../../../../packages/sarmal/package.json";

export const VERSION = pkg.version;
export const DEFAULT_ENGINE_TRAIL_LENGTH = 120;

export type ResolvedPlaygroundOptions = {
  trailColor: SarmalOptions["trailColor"];
  trailStyle: SarmalOptions["trailStyle"];
  skeletonColor: SarmalOptions["skeletonColor"];
  headColor?: string;
  headRadius?: number;
  trailWidth?: number;
  trailLength?: number;
};

export function pointsToString(points: Array<DrawingSegment>): string {
  const lines = points.map(([x, y]) => `  [${x.toFixed(2)}, ${y.toFixed(2)}]`);
  return `[\n${lines.join(",\n")},\n]`;
}

export function resolvePlaygroundRuntimeOptions(pg: PlaygroundState): ResolvedPlaygroundOptions {
  const opts: ResolvedPlaygroundOptions = {
    trailColor: pg.resolvedTrailColor,
    trailStyle: pg.trailStyle,
    skeletonColor: pg.resolvedSkeletonColor,
  };

  if (!pg.headColorAuto) {
    opts.headColor = pg.headColor;
  }

  if (pg.headRadius !== null) {
    opts.headRadius = pg.headRadius;
  }

  if (pg.trailWidth !== null) {
    opts.trailWidth = pg.trailWidth;
  }

  if (pg.trailLength !== DEFAULT_ENGINE_TRAIL_LENGTH) {
    opts.trailLength = pg.trailLength;
  }

  return opts;
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
    ref: `{\n  name: 'custom',\n  fn: (phase, elapsed) => {\n${indented}\n  },\n}`,
    imports: [],
  };
}

export function serializeSharedColorOptions(pg: PlaygroundState): string[] {
  const resolved = resolvePlaygroundRuntimeOptions(pg);
  const parts: string[] = [];

  if (resolved.trailStyle !== "default") {
    parts.push(`trailStyle: '${resolved.trailStyle}'`);
  }

  parts.push(`trailColor: ${formatTrailColor(pg)}`);

  if (pg.showSkeleton) {
    parts.push(`skeletonColor: '${resolved.skeletonColor}'`);
  }

  if (resolved.headColor !== undefined) {
    parts.push(`headColor: '${resolved.headColor}'`);
  }

  return parts;
}

export function serializeOptions(pg: PlaygroundState): string | null {
  const resolved = resolvePlaygroundRuntimeOptions(pg);
  const parts = serializeSharedColorOptions(pg);

  if (resolved.headRadius !== undefined) {
    parts.push(`headRadius: ${resolved.headRadius}`);
  }

  if (resolved.trailWidth !== undefined) {
    parts.push(`trailWidth: ${resolved.trailWidth}`);
  }

  if (resolved.trailLength !== undefined) {
    parts.push(`trailLength: ${resolved.trailLength}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

export function serializeReactOptions(pg: PlaygroundState): string | null {
  const resolved = resolvePlaygroundRuntimeOptions(pg);
  const parts = serializeSharedColorOptions(pg);

  if (resolved.headRadius !== undefined) {
    parts.push(`headRadius: ${resolved.headRadius}`);
  }

  if (resolved.trailWidth !== undefined) {
    parts.push(`trailWidth: ${resolved.trailWidth}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

export function serializeReactInit(pg: PlaygroundState): string | null {
  const resolved = resolvePlaygroundRuntimeOptions(pg);
  const parts: string[] = [];

  if (resolved.trailLength !== undefined) {
    parts.push(`trailLength: ${resolved.trailLength}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}
