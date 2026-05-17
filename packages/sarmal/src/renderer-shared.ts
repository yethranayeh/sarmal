import type { Engine, Point, RuntimeRenderOptions, TrailColor, TrailStyle } from "./types";

export const DEFAULT_MORPH_DURATION_MS = 300;
export const DEFAULT_SKELETON_OPACITY = 0.15;
/** Fraction of the bounding-box dimension added as proportional padding on each side when fitting the curve. */
export const FIT_PADDING = 0.1;
export const FIT_PADDING_MIN = 4;
/** Higher values = sharper fade near the tail, more of the trail appears faint */
export const TRAIL_FADE_CURVE = 1.5;
export const TRAIL_MAX_OPACITY = 0.88;
/** Pixel-space stroke/line width at the tail which the SVG renderer overrides with viewBox unit values */
export const TRAIL_MIN_WIDTH = 0.5;
/** Pixel-space stroke/line width at the head which the SVG renderer overrides with viewBox unit values */
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
 * Computes the quad corners and style for one ribbon segment in the renderer's coordinate space (pixel-space for canvas, viewBox-space for SVG)
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
  minWidth = TRAIL_MIN_WIDTH,
  maxWidth = TRAIL_MAX_WIDTH,
): TrailQuad {
  const progress = i / (trailCount - 1);
  const nextProgress = (i + 1) / (trailCount - 1);
  const opacity = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
  const w0 = (minWidth + progress * (maxWidth - minWidth)) / 2;
  const w1 = (minWidth + nextProgress * (maxWidth - minWidth)) / 2;

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
 * Padding per side is `max(FIT_PADDING * dim, minPaddingPx)`, so the stricter constraint wins.
 * `minPaddingPx` defaults to `FIT_PADDING_MIN` (4px) for pixel-space callers.
 * Pass `0` when the logical space is itself a normalized viewBox (e.g. SVG export).
 */
export function computeBoundaries(
  pts: Point[],
  logicalWidth: number,
  logicalHeight: number,
  minPaddingPx = FIT_PADDING_MIN,
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

  const scaleXMinPadding = (logicalWidth - minPaddingPx * 2) / w;
  const scaleYMinPadding = (logicalHeight - minPaddingPx * 2) / h;

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
    getSarmalSkeleton: engine.getSarmalSkeleton,
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
  rocketpop: ["#08b8cd", "#ffffff", "#ff001f"],
  neon: ["#00e5ff", "#7c3aed", "#e040fb"],
  carnival: ["#ff6b6b", "#4ecdc4", "#ffe66d"],
  vaporwave: ["#ff71ce", "#01cdfe", "#b967ff"],
  pastel: ["#c4b5fd", "#fbcfe8", "#bae6fd"],
  sakura: ["#fff1f2", "#fda4af", "#fb7185"],
} as const satisfies Record<string, Array<string>>;
export type SarmalPalette = keyof typeof palettes; // TODO: reconsider naming convention. Should this represent the value type instead of the key union?

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

const HEX_3_RE = /^#([0-9a-fA-F]{3})$/;
const HEX_6_RE = /^#([0-9a-fA-F]{6})$/;
const HEX_8_RE = /^#([0-9a-fA-F]{8})$/;
const RGB_RE =
  /^rgba?\(\s*(-?\d{1,3})\s*,\s*(-?\d{1,3})\s*,\s*(-?\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i;

/**
 * Parses a color string in any supported format into Rgb components.
 * Returns `null` for unrecognized or malformed input.
 *
 * Supported formats:
 * - 3-digit hex: #rgb
 * - 6-digit hex: #rrggbb
 * - 8-digit hex: #rrggbbaa (alpha is silently stripped)
 * - rgb(r, g, b) channels clamped to 0–255
 * - rgba(r, g, b, a) alpha is silently stripped
 */
export function parseColorToRgb(s: string): Rgb | null {
  const trimmed = s.trim();

  const m3 = HEX_3_RE.exec(trimmed);
  if (m3) {
    const [r, g, b] = m3[1]!;
    return hexToRgb(`#${r}${r}${g}${g}${b}${b}`);
  }

  const m6 = HEX_6_RE.exec(trimmed);
  if (m6) {
    return hexToRgb(trimmed);
  }

  const m8 = HEX_8_RE.exec(trimmed);
  if (m8) {
    return hexToRgb(`#${trimmed.slice(1, 7)}`);
  }

  const mRgb = RGB_RE.exec(trimmed);
  if (mRgb) {
    return {
      r: Math.max(0, Math.min(255, parseInt(mRgb[1]!, 10))),
      g: Math.max(0, Math.min(255, parseInt(mRgb[2]!, 10))),
      b: Math.max(0, Math.min(255, parseInt(mRgb[3]!, 10))),
    };
  }

  return null;
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/i;

/**
 * Parses an oklch() color string directly to Oklab.
 * Returns `null` for unrecognized or malformed input.
 *
 * Accepted syntax (subset of CSS Color 4):
 * - oklch(L C H) bare floats, L clamped to 0–1, C clamped to 0–0.4, H in degrees
 * - oklch(L C H / alpha) alpha silently stripped
 *
 * ! Not supported: percentages, `none` keyword, negative hues
 */
export function parseOklchToOklab(s: string): Oklab | null {
  const m = OKLCH_RE.exec(s.trim());
  if (!m) {
    return null;
  }

  const L = parseFloat(m[1]!);
  const C = parseFloat(m[2]!);
  const H = parseFloat(m[3]!);

  if (Number.isNaN(L) || Number.isNaN(C) || Number.isNaN(H)) {
    return null;
  }

  const clampedL = Math.max(0, Math.min(1, L));
  const clampedC = Math.max(0, Math.min(0.4, C));
  const H_rad = H * (Math.PI / 180);

  return {
    L: clampedL,
    a: clampedC * Math.cos(H_rad),
    b: clampedC * Math.sin(H_rad),
  };
}

/**
 * Unified color-to-Oklab entry point.
 * Tries oklch() first (direct to Oklab), then falls back through the sRGB path.
 */
export function parseColorToOklab(s: string): Oklab | null {
  const oklab = parseOklchToOklab(s);
  if (oklab !== null) {
    return oklab;
  }

  const rgb = parseColorToRgb(s);
  if (rgb === null) {
    return null;
  }

  return rgbToOklab(rgb);
}

/** Converts any accepted color string to Rgb. Throws if the format is unrecognized. */
export function colorToRgb(color: string): Rgb {
  const rgb = parseColorToRgb(color);
  if (rgb !== null) {
    return rgb;
  }

  const lab = parseOklchToOklab(color);
  if (lab !== null) {
    return oklabToRgb(lab);
  }

  throw new Error(`[sarmal] unrecognized color "${color}"`);
}

/** sRGB byte (0–255) to linear light (0–1)
 * @see {@link https://bottosson.github.io/posts/oklab/}
 */
function srgbByteToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

/** Linear light (0–1) to sRGB byte (0–255), gamma-compressed and clamped */
function linearToSrgbByte(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/**
 * sRGB Rgb to OKLab
 * @see {@link https://bottosson.github.io/posts/oklab/}
 */
export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const rl = srgbByteToLinear(r),
    gl = srgbByteToLinear(g),
    bl = srgbByteToLinear(b);
  const l = Math.cbrt(0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl);
  const m = Math.cbrt(0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl);
  const s = Math.cbrt(0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab to sRGB Rgb, out-of-gamut values clamped to 0–255 */
export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.29145603 * b;
  const l = l_ * l_ * l_,
    m = m_ * m_ * m_,
    s = s_ * s_ * s_;

  return {
    r: linearToSrgbByte(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgbByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgbByte(-0.0041960863 * l - 0.7034186147 * m + 1.6076099202 * s),
  };
}

/** Interpolates between two OKLab colors without any gray dead zone */
export const lerpOklab = (a: Oklab, b: Oklab, t: number): Oklab => {
  if (t <= 0) {
    return a;
  }

  if (t >= 1) {
    return b;
  }

  return {
    L: a.L + (b.L - a.L) * t,
    a: a.a + (b.a - a.a) * t,
    b: a.b + (b.b - a.b) * t,
  };
};

/**
 * Gets a color from a palette based on position (0-1) with optional time-based cycling
 * @param palette Array of Oklab colors
 * @param position Position along the gradient (0 = start, 1 = end)
 * @param timeOffset Optional time offset for animated gradients
 */
export function getPaletteColor(palette: Oklab[], position: number, timeOffset: number = 0): Oklab {
  if (palette.length === 0) {
    return { L: 1, a: 0, b: 0 };
  }

  if (palette.length === 1) {
    return palette[0]!;
  }

  const cyclePos = (((position + timeOffset) % 1) + 1) % 1;
  const scaled = cyclePos * palette.length;
  const idx = Math.floor(scaled);
  const t = scaled - idx;

  const c1 = palette[idx % palette.length]!;
  const c2 = palette[(idx + 1) % palette.length]!;

  return lerpOklab(c1, c2, t);
}

// TODO: maybe should infer the union type from the variable instead of making the variable respect the predefined union type
const TRAIL_STYLES: readonly TrailStyle[] = ["default", "gradient-static", "gradient-animated"];

// FIXME: Should inherit from the actual render option object to avoid drift
const RENDER_OPTION_KEYS: ReadonlySet<string> = new Set([
  "trailColor",
  "headColor",
  "skeletonColor",
  "trailStyle",
  "headRadius",
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
  if (partial.headRadius !== undefined) {
    assertHeadRadius(partial.headRadius);
  }
}

function assertTrailColor(value: TrailColor) {
  if (typeof value === "string") {
    if (parseColorToOklab(value) === null) {
      throw new TypeError(
        `[sarmal] setRenderOptions: trailColor must be a valid color string (#rrggbb, #rgb, rgb(), rgba(), oklch()), got "${value}"`,
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
      if (typeof entry !== "string" || parseColorToOklab(entry) === null) {
        throw new TypeError(
          `[sarmal] setRenderOptions: trailColor[${i}] must be a valid color string (#rrggbb, #rgb, rgb(), rgba(), oklch()), got ${JSON.stringify(entry)}`,
        );
      }
    }
    return;
  }

  throw new TypeError(
    `[sarmal] setRenderOptions: trailColor must be a valid color string (#rrggbb, #rgb, rgb(), rgba(), oklch()) or an array of color strings, got ${JSON.stringify(value)}`,
  );
}

function assertHeadColor(value: string | null) {
  if (value === null) {
    return;
  }

  if (typeof value !== "string" || parseColorToOklab(value) === null) {
    throw new TypeError(
      `[sarmal] setRenderOptions: headColor must be a valid color string (#rrggbb, #rgb, rgb(), rgba(), oklch()) or null, got ${JSON.stringify(value)}`,
    );
  }
}

function assertSkeletonColor(value: string) {
  if (value === "transparent") {
    return;
  }

  if (typeof value !== "string" || parseColorToOklab(value) === null) {
    throw new TypeError(
      `[sarmal] setRenderOptions: skeletonColor must be a valid color string (#rrggbb, #rgb, rgb(), rgba(), oklch()) or "transparent", got ${JSON.stringify(value)}`,
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

function assertHeadRadius(value: number) {
  if (typeof value !== "number") {
    throw new TypeError(
      `[sarmal] setRenderOptions: headRadius must be a number, got ${JSON.stringify(value)}`,
    );
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(
      `[sarmal] setRenderOptions: headRadius must be a finite positive number, got ${value}`,
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
    return resolveTrailMainColor(trailColor);
  }

  const palette = resolveTrailPalette(trailColor);
  const last = palette[palette.length - 1]!;
  const { r, g, b } = colorToRgb(last);
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
