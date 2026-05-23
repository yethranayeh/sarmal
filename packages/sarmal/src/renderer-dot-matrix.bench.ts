import { bench, describe } from "vitest";
import type { Rgb } from "./renderer-shared";

// ── Mock ctx ─────────────────────────────────────────────────────────────────
// No-op canvas context. Measuring our loop/computation cost, not canvas itself.

const mockCtx = {
  beginPath() {},
  roundRect(_x: number, _y: number, _w: number, _h: number, _r: number) {},
  fill() {},
  clearRect(_x: number, _y: number, _w: number, _h: number) {},
  putImageData(_data: unknown, _x: number, _y: number) {},
  fillStyle: "",
  globalAlpha: 1,
};

type MockCtx = typeof mockCtx;

// ── Shared gradient & helper ──────────────────────────────────────────────────

const GRAD_STOPS: Rgb[] = [
  { r: 0, g: 198, b: 255 },
  { r: 0, g: 114, b: 255 },
  { r: 133, g: 0, b: 255 },
  { r: 255, g: 0, b: 163 },
];

function sampleGradientRgb(stops: Rgb[], t: number): Rgb {
  const n = stops.length;
  const scaled = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(Math.floor(scaled), n - 2);
  const a = stops[i]!;
  const b = stops[i + 1]!;
  const mix = scaled - i;
  return {
    r: Math.round(a.r + (b.r - a.r) * mix),
    g: Math.round(a.g + (b.g - a.g) * mix),
    b: Math.round(a.b + (b.b - a.b) * mix),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CANVAS_SIZE = 240;

/**
 * Synthetic trail grid: a lissajous-like path stamped into a flat intensity buffer.
 * Roughly 15% of cells will be lit at varying intensities — representative of real usage.
 */
function buildGrid(cols: number, rows: number): Float32Array {
  const grid = new Float32Array(cols * rows);
  const trailLength = cols * 3;
  for (let i = 0; i < trailLength; i++) {
    const t = i / trailLength;
    const intensity = (i + 1) / trailLength;
    const x = Math.sin(t * Math.PI * 2 * 3);
    const y = Math.sin(t * Math.PI * 2 * 4 + Math.PI / 4);
    const col = Math.max(0, Math.min(cols - 1, Math.round(((x + 1) / 2) * (cols - 1))));
    const row = Math.max(0, Math.min(rows - 1, Math.round(((y + 1) / 2) * (rows - 1))));
    const idx = row * cols + col;
    if (intensity > grid[idx]!) {
      grid[idx] = intensity;
    }
  }
  return grid;
}

/**
 * Flat-packed pixel mask for the putImageData approach.
 * Pre-computed once at init: for each dot, stores the RGBA byte offsets of every pixel inside its circle.
 * `starts[dotIdx]` = offset into `indices` where this dot's pixels begin.
 * `lengths[dotIdx]` = number of pixels in this dot.
 */
type PixelMask = {
  starts: Uint32Array;
  lengths: Uint32Array;
  indices: Uint32Array;
};

function buildPixelMask(cols: number, rows: number): PixelMask {
  const W = CANVAS_SIZE;
  const H = CANVAS_SIZE;
  const cellW = W / cols;
  const cellH = H / rows;
  const dotR = Math.min(cellW, cellH) * 0.36;
  const dotR2 = dotR * dotR;

  const allIndices: number[] = [];
  const starts = new Uint32Array(cols * rows);
  const lengths = new Uint32Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const dotIdx = row * cols + col;
      const cx = (col + 0.5) * cellW;
      const cy = (row + 0.5) * cellH;
      const x0 = Math.max(0, Math.floor(cx - dotR));
      const x1 = Math.min(W - 1, Math.ceil(cx + dotR));
      const y0 = Math.max(0, Math.floor(cy - dotR));
      const y1 = Math.min(H - 1, Math.ceil(cy + dotR));

      starts[dotIdx] = allIndices.length;
      let count = 0;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          // sample from pixel center
          const dx = px + 0.5 - cx;
          const dy = py + 0.5 - cy;
          if (dx * dx + dy * dy <= dotR2) {
            allIndices.push((py * W + px) * 4);
            count++;
          }
        }
      }
      lengths[dotIdx] = count;
    }
  }

  return { starts, lengths, indices: new Uint32Array(allIndices) };
}

// ── Drawing approaches ────────────────────────────────────────────────────────

/** Current library implementation: N passes over the grid, one fill() call per non-empty bucket. */
function drawBuckets(
  grid: Float32Array,
  ctx: MockCtx,
  cols: number,
  rows: number,
  numBuckets: number,
  stops: Rgb[],
) {
  const cellW = CANVAS_SIZE / cols;
  const cellH = CANVAS_SIZE / rows;
  const dotR = Math.min(cellW, cellH) * 0.36;

  for (let bucket = 0; bucket < numBuckets; bucket++) {
    const lo = bucket / numBuckets;
    const hi = (bucket + 1) / numBuckets;
    const midpoint = (lo + hi) / 2;

    let hasLit = false;
    ctx.beginPath();

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const intensity = grid[row * cols + col]!;
        if (intensity > lo && intensity <= hi) {
          const cx = (col + 0.5) * cellW;
          const cy = (row + 0.5) * cellH;
          ctx.roundRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2, dotR);
          hasLit = true;
        }
      }
    }

    if (hasLit) {
      const { r, g, b } = sampleGradientRgb(stops, midpoint);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.globalAlpha = 0.08 + midpoint * 0.92;
      ctx.fill();
    }
  }
}

/** Alternative: one pass, one beginPath+fill per lit dot. Color sampled at exact intensity. */
function drawPerDot(grid: Float32Array, ctx: MockCtx, cols: number, rows: number, stops: Rgb[]) {
  const cellW = CANVAS_SIZE / cols;
  const cellH = CANVAS_SIZE / rows;
  const dotR = Math.min(cellW, cellH) * 0.36;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const intensity = grid[row * cols + col]!;
      if (intensity > 0) {
        const cx = (col + 0.5) * cellW;
        const cy = (row + 0.5) * cellH;
        ctx.beginPath();
        ctx.roundRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2, dotR);
        const { r, g, b } = sampleGradientRgb(stops, intensity);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.globalAlpha = 0.08 + intensity * 0.92;
        ctx.fill();
      }
    }
  }
}

/** Alternative: write RGBA directly into a typed array, one putImageData call per frame.
 *  Requires a pre-computed pixel mask (init cost amortized across all frames).
 *  Trade-off: no sub-pixel anti-aliasing on dot edges. */
function drawImageData(grid: Float32Array, mask: PixelMask, rgba: Uint8ClampedArray, stops: Rgb[]) {
  rgba.fill(0);

  const { starts, lengths, indices } = mask;
  const n = grid.length;
  for (let dotIdx = 0; dotIdx < n; dotIdx++) {
    const intensity = grid[dotIdx]!;
    if (intensity > 0) {
      const { r, g, b } = sampleGradientRgb(stops, intensity);
      const a = Math.round((0.08 + intensity * 0.92) * 255);
      const start = starts[dotIdx]!;
      const len = lengths[dotIdx]!;
      for (let k = 0; k < len; k++) {
        const px = indices[start + k]!;
        rgba[px] = r;
        rgba[px + 1] = g;
        rgba[px + 2] = b;
        rgba[px + 3] = a;
      }
    }
  }
  // In real usage this is followed by ctx.putImageData(imageData, 0, 0) — one call.
}

// ── Suites ────────────────────────────────────────────────────────────────────

const SIZES = [16, 32, 48, 56] as const;

for (const size of SIZES) {
  const grid = buildGrid(size, size);
  const mask = buildPixelMask(size, size);
  const rgba = new Uint8ClampedArray(CANVAS_SIZE * CANVAS_SIZE * 4);

  describe(`${size}×${size}`, () => {
    bench("buckets-8  (current)", () => {
      drawBuckets(grid, mockCtx, size, size, 8, GRAD_STOPS);
    });

    bench("buckets-16", () => {
      drawBuckets(grid, mockCtx, size, size, 16, GRAD_STOPS);
    });

    bench("buckets-32", () => {
      drawBuckets(grid, mockCtx, size, size, 32, GRAD_STOPS);
    });

    bench("per-dot", () => {
      drawPerDot(grid, mockCtx, size, size, GRAD_STOPS);
    });

    bench("put-image-data", () => {
      drawImageData(grid, mask, rgba, GRAD_STOPS);
    });
  });
}
