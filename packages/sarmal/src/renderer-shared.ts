import type { Engine, Point } from "./types";

export const DEFAULT_MORPH_DURATION_MS = 300;
export const DEFAULT_SKELETON_OPACITY = 0.15;
/** Fraction of the bounding-box dimension added as proportional padding on each side when fitting the curve. */
export const FIT_PADDING = 0.1;
export const FIT_PADDING_MIN = 4;
/** Higher values = sharper fade near the tail, more of the trail appears faint */
export const TRAIL_FADE_CURVE = 1.5;
export const TRAIL_MAX_OPACITY = 0.88;
/** Stroke/line width at the tail */
export const TRAIL_MIN_WIDTH = 0.5;
/** Stroke/line width at the head */
export const TRAIL_MAX_WIDTH = 2.5;

export interface TrailPoint {
  x: number;
  y: number;
}

/**
 * Computes the unit tangent vector at a point on the trail.
 * - Interior points: central difference (previous -> next)
 * - Endpoints: forward/backward difference
 */
export function computeTangent(trail: TrailPoint[], i: number): TrailPoint {
  const count = trail.length;
  if (count < 2) {
    return { x: 1, y: 0 };
  }

  if (i === 0) {
    const dx = trail[1]!.x - trail[0]!.x;
    const dy = trail[1]!.y - trail[0]!.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  if (i === count - 1) {
    const dx = trail[count - 1]!.x - trail[count - 2]!.x;
    const dy = trail[count - 1]!.y - trail[count - 2]!.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  const dx = trail[i + 1]!.x - trail[i - 1]!.x;
  const dy = trail[i + 1]!.y - trail[i - 1]!.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Computes the unit normal vector at a point on the trail.
 * The normal is perpendicular to the tangent, rotated 90° counter-clockwise
 */
export function computeNormal(trail: TrailPoint[], i: number): TrailPoint {
  const tangent = computeTangent(trail, i);
  return { x: -tangent.y, y: tangent.x };
}

/** The four pixel-space corners and per-segment style values for one ribbon quad */
export interface TrailQuad {
  /** Left corner at the tail end of this segment */
  l0x: number;
  l0y: number;
  /** Right corner at the tail end of this segment */
  r0x: number;
  r0y: number;
  /** Left corner at the head end of this segment */
  l1x: number;
  l1y: number;
  /** Right corner at the head end of this segment */
  r1x: number;
  r1y: number;
  /** Fill opacity for this segment (0–1) */
  opacity: number;
  /** Position along the trail (0 = tail, 1 = head) */
  progress: number;
}

/**
 * Computes the pixel-space quad corners and style for one ribbon segment.
 *
 * @param trail  Full trail array
 * @param i      Segment index (draws from point i to point i+1)
 * @param trailCount  Number of active trail points
 * @param toX    Convert a trail point to its pixel X coordinate
 * @param toY    Convert a trail point to its pixel Y coordinate
 *
 * @see https://mattdesl.svbtle.com/drawing-lines-is-hard
 *      DesLauriers: "Triangulated Lines" - expand points outward by half
 *      the thickness on either side using normals to create thick lines.
 */
export function computeTrailQuad(
  trail: TrailPoint[],
  i: number,
  trailCount: number,
  toX: (p: TrailPoint) => number,
  toY: (p: TrailPoint) => number,
): TrailQuad {
  const progress = i / (trailCount - 1);
  const nextProgress = (i + 1) / (trailCount - 1);
  const opacity = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
  const w0 = (TRAIL_MIN_WIDTH + progress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH)) / 2;
  const w1 = (TRAIL_MIN_WIDTH + nextProgress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH)) / 2;

  const curr = trail[i]!;
  const next = trail[i + 1]!;
  const n0 = computeNormal(trail, i);
  const n1 = computeNormal(trail, i + 1);

  const cx = toX(curr);
  const cy = toY(curr);
  const nx = toX(next);
  const ny = toY(next);

  return {
    l0x: cx + n0.x * w0,
    l0y: cy + n0.y * w0,
    r0x: cx - n0.x * w0,
    r0y: cy - n0.y * w0,
    l1x: nx + n1.x * w1,
    l1y: ny + n1.y * w1,
    r1x: nx - n1.x * w1,
    r1y: ny - n1.y * w1,
    opacity,
    progress,
  };
}

export interface BoundaryResult {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Computes how to map engine coordinates into a viewport of the given logical size.
 * ! Returns `null` if `pts` is empty
 * ! Throws if all points are identical
 *
 * Padding per side is `max(FIT_PADDING * dim, FIT_PADDING_MIN)`, so the stricter constraint wins
 */
export function computeBoundaries(
  pts: Point[],
  logicalWidth: number,
  logicalHeight: number,
): BoundaryResult | null {
  if (pts.length === 0) return null;

  const first = pts[0]!;
  let minX = first.x,
    maxX = first.x,
    minY = first.y,
    maxY = first.y;

  for (const p of pts) {
    if (p.x < minX) {
      minX = p.x;
    }
    if (p.x > maxX) {
      maxX = p.x;
    }
    if (p.y < minY) {
      minY = p.y;
    }
    if (p.y > maxY) {
      maxY = p.y;
    }
  }

  const w = maxX - minX;
  const h = maxY - minY;

  if (w === 0 && h === 0) {
    throw new Error(
      "[sarmal] Degenerate curve: all skeleton points are identical. " +
        "Check that your curve fn returns distinct points for different values of t.",
    );
  }

  const scaleXProportional = logicalWidth / (w * (1 + FIT_PADDING * 2));
  const scaleYProportional = logicalHeight / (h * (1 + FIT_PADDING * 2));

  const scaleXMinPadding = (logicalWidth - FIT_PADDING_MIN * 2) / w;
  const scaleYMinPadding = (logicalHeight - FIT_PADDING_MIN * 2) / h;

  const scale = Math.min(
    scaleXProportional,
    scaleYProportional,
    scaleXMinPadding,
    scaleYMinPadding,
  );

  return {
    scale,
    offsetX: (logicalWidth - w * scale) / 2 - minX * scale,
    offsetY: (logicalHeight - h * scale) / 2 - minY * scale,
  };
}

/**
 * Returns the engine methods that are pure pass-throughs on both renderers
 * The engine does not use `this`, so direct assignment is safe
 */
export function enginePassthroughs(engine: Engine) {
  return {
    jump: engine.jump,
    seek: engine.seek,
    setSpeed: engine.setSpeed,
    getSpeed: engine.getSpeed,
    resetSpeed: engine.resetSpeed,
    setSpeedOver: engine.setSpeedOver,
  };
}
