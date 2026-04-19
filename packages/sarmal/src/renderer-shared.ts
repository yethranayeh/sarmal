import type { Engine, Point, RuntimeRenderOptions, TrailColor, TrailStyle } from "./types";

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

/**
 * Can be passed directly to `trailColor`,
 *  or can be mixed/sliced before passing as a prop.
 */
export const palettes = {
  bard: ["#a855f7", "#3b82f6", "#14b8a6", "#ec4899"],
  sunset: ["#f97316", "#dc2626", "#9333ea", "#f472b6"],
  ocean: ["#1e3a8a", "#06b6d4", "#22d3ee", "#e0f2fe"],
  ice: ["#1e3a8a", "#67e8f9"],
  fire: ["#7f1d1d", "#fbbf24"],
  forest: ["#14532d", "#86efac"],
} as const satisfies Record<string, string[]>;

/** RGB color components */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Converts a hex color string to RGB components */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}

/** Linear interpolation between two RGB colors */
export const lerpRgb = (a: Rgb, b: Rgb, t: number) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

/**
 * Gets a color from a palette based on position (0-1) with optional time-based cycling
 * @param palette Array of hex color strings
 * @param position Position along the gradient (0 = start, 1 = end)
 * @param timeOffset Optional time offset for animated gradients
 */
export function getPaletteColor(palette: string[], position: number, timeOffset: number = 0): Rgb {
  if (palette.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  if (palette.length === 1) {
    return hexToRgb(palette[0]!);
  }

  const cyclePos = (position + timeOffset) % 1;
  const scaled = cyclePos * palette.length;
  const idx = Math.floor(scaled);
  const t = scaled - idx;

  const c1 = hexToRgb(palette[idx % palette.length]!);
  const c2 = hexToRgb(palette[(idx + 1) % palette.length]!);

  return lerpRgb(c1, c2, t);
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// TODO: maybe should infer the union type from the variable instead of making the variable respect the predefined union type
const TRAIL_STYLES: readonly TrailStyle[] = ["default", "gradient-static", "gradient-animated"];

// FIXME: Should inherit from the actual render option object to avoid drift
const RENDER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "trailColor",
  "headColor",
  "skeletonColor",
  "trailStyle",
]);

/**
 * Checks a `RuntimeRenderOptions` payload against the library's acceptance criteria.
 *
 * If this throws, no field has been assigned yet on the caller side,
 *  so the renderer continues on the previous valid state.
 *
 * Rules:
 * - Unknown keys throw for runtime type safety
 * - `trailColor` must match expected string/Array<string> format
 * - `headColor` must match expected color string format OR `null`
 * - `skeletonColor` must match expected color string format OR the literal `"transparent"`.
 * - `trailStyle` must match one of the accepted modes
 *
 * ! Field combinations like `trailColor="#ffffff"` with `trailStyle="gradient-animated"` are NOT rejected
 *  They only produce a console warning at the renderer to indicate an unexpected outcome
 */
export function validateRenderOptions(partial: RuntimeRenderOptions) {
  for (const key of Object.keys(partial)) {
    if (!RENDER_OPTION_KEYS.has(key)) {
      throw new TypeError(`[sarmal] setRenderOptions: unknown key "${key}"`);
    }
  }

  if (partial.trailColor !== undefined) {
    assertTrailColor(partial.trailColor);
  }
  if (partial.headColor !== undefined) {
    assertHeadColor(partial.headColor);
  }
  if (partial.skeletonColor !== undefined) {
    assertSkeletonColor(partial.skeletonColor);
  }
  if (partial.trailStyle !== undefined) {
    assertTrailStyle(partial.trailStyle);
  }
}

function assertTrailColor(value: TrailColor) {
  if (typeof value === "string") {
    if (!HEX_COLOR_RE.test(value)) {
      throw new TypeError(
        `[sarmal] setRenderOptions: trailColor must be a 6-digit hex string, got "${value}"`,
      );
    }
    return;
  }

  if (Array.isArray(value)) {
    if (value.length < 2) {
      throw new RangeError(
        `[sarmal] setRenderOptions: trailColor array must have at least 2 entries, got ${value.length}`,
      );
    }

    for (let i = 0; i < value.length; i++) {
      const entry = value[i];
      if (typeof entry !== "string" || !HEX_COLOR_RE.test(entry)) {
        throw new TypeError(
          `[sarmal] setRenderOptions: trailColor[${i}] must be a 6-digit hex string, got ${JSON.stringify(entry)}`,
        );
      }
    }
    return;
  }

  throw new TypeError(
    `[sarmal] setRenderOptions: trailColor must be a 6-digit hex string or an array of hex strings, got ${JSON.stringify(value)}`,
  );
}

function assertHeadColor(value: string | null) {
  if (value === null) {
    return;
  }

  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
    throw new TypeError(
      `[sarmal] setRenderOptions: headColor must be a 6-digit hex string or null, got ${JSON.stringify(value)}`,
    );
  }
}

function assertSkeletonColor(value: string) {
  if (value === "transparent") {
    return;
  }

  if (typeof value !== "string" || !HEX_COLOR_RE.test(value)) {
    throw new TypeError(
      `[sarmal] setRenderOptions: skeletonColor must be a 6-digit hex string or "transparent", got ${JSON.stringify(value)}`,
    );
  }
}

function assertTrailStyle(value: TrailStyle) {
  if (!TRAIL_STYLES.includes(value)) {
    // TODO: perhaps make Trail Style inferred from a variable so it can be spread here to keep it dynamic.
    throw new RangeError(
      `[sarmal] setRenderOptions: trailStyle must be one of "default", "gradient-static", "gradient-animated", got ${JSON.stringify(value)}`,
    );
  }
}

/**
 * Resolves the effective solid fill color used by the `"default"` trail style.
 * If the caller passed an array, the first entry is used.
 *
 * This is to avoid errors when an array of colors are passed for `trailStyle="default"`
 */
export function resolveTrailMainColor(trailColor: TrailColor) {
  return typeof trailColor === "string" ? trailColor : trailColor[0]!;
}

/**
 * Resolves the effective palette used by gradient trail styles.
 *
 * This is to avoid errors when a single color string is passed for gradient trail styles
 */
export function resolveTrailPalette(trailColor: TrailColor): string[] {
  return typeof trailColor === "string" ? [trailColor] : trailColor;
}

/**
 * Computes the head color automatically from the current `trailColor` and `trailStyle` pair.
 *
 * Rules:
 * - `"default"` style: the head matches the solid trail color.
 * - Gradient styles: the head matches the *last* stop of the palette
 *
 * @returns a CSS-valid color string
 */
export function resolveHeadColor(trailColor: TrailColor, trailStyle: TrailStyle): string {
  if (trailStyle === "default") {
    // TODO: should it return hex here instead of rgb?
    return resolveTrailMainColor(trailColor);
  }

  const palette = resolveTrailPalette(trailColor);
  const last = palette[palette.length - 1]!;
  const { r, g, b } = hexToRgb(last);
  return `rgb(${r},${g},${b})`;
}

/**
 * Emits a console warning when `trailColor` and `trailStyle` don't *semantically* match up
 *
 * For example, an array passed with `"default"` style (only the first color is used) or
 *  a single string passed with a gradient style (the trail renders as a solid color)
 *
 * ! This is only a warning, so the renderer will still produce a valid output
 */
export function warnIfTrailColorMismatch(trailColor: TrailColor, trailStyle: TrailStyle): void {
  if (trailStyle === "default" && Array.isArray(trailColor)) {
    // biome-ignore lint/suspicious/noConsole: advisory for developer feedback
    console.warn(
      '[sarmal] trailColor is an array but trailStyle is "default"; only the first color will be used. Pass a gradient trailStyle to use the whole palette.',
    );

    return;
  }

  if (trailStyle !== "default" && typeof trailColor === "string") {
    // biome-ignore lint/suspicious/noConsole: advisory for developer feedback
    console.warn(
      `[sarmal] trailColor is a single color but trailStyle is "${trailStyle}"; the trail will render as a solid color. Pass an array of hex colors to use a real gradient.`,
    );
  }
}

export const getHeadDotRadius = (w: number, h: number) =>
  Math.max(1, 3 * Math.sqrt(Math.min(w, h) / 160));
