import type { Point, RendererOptions, SarmalInstance } from "./types";

const DEFAULT_HEAD_RADIUS = 4;
const DEFAULT_GLOW_SIZE = 20;
const DEFAULT_SKELETON_COLOR = "#ffffff";
const DEFAULT_SKELETON_OPACITY = 0.15;

/** Fraction of the bounding box added as padding when fitting the curve to the canvas */
const FIT_PADDING = 0.1;

/**
 * The trail is drawn in batches of points
 * Each batch has lower opacity than the one that comes before it
 *  (0 = oldest/tail, 1 = newest/head)
 */
const TRAIL_BATCH_SIZE = 10;
/** Higher values = sharper fade near the tail, more of the trail appears faint */
const TRAIL_FADE_CURVE = 1.5;
const TRAIL_MAX_OPACITY = 0.88;
/** Line width of tail */
const TRAIL_MIN_WIDTH = 0.5;
/** Line width of head */
const TRAIL_MAX_WIDTH = 2.5;

const GLOW_INNER_EDGE = 0.4;
/** Opacity at the inner edge of the glow falloff */
const GLOW_FALLOFF_OPACITY = 0.53;

// TODO: might as well accept rgb/rgba directly too
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Creates a Canvas 2D renderer for sarmal animations
 * Renders the skeleton, the trail, and the glowing dot.
 */
export function createRenderer(options: RendererOptions): SarmalInstance {
  const canvas = options.canvas;
  if (!canvas.getContext("2d")) {
    throw new Error("Could not get 2d context from canvas");
  }
  const ctx = canvas.getContext("2d")!;

  const engine = options.engine;
  const opts = {
    skeletonColor: options.skeletonColor ?? DEFAULT_SKELETON_COLOR,
    trailColor: options.trailColor ?? "#ffffff",
    headColor: options.headColor ?? "#ffffff",
    headRadius: options.headRadius ?? DEFAULT_HEAD_RADIUS,
    glowSize: options.glowSize ?? DEFAULT_GLOW_SIZE,
  };

  let skeleton: Array<Point> = [];
  let trail: Array<Point> = [];
  let head: Point | null = null;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let animationId: number | null = null;
  let lastTime = 0;

  /**
   * Computes how to map engine coordinates to canvas pixels
   *
   * Steps are roughly: curve fn -> coordinate point -> (scale + offset) -> pixel
   *
   * 1. Find the bounding box of the skeleton (min/max x/y in coordinates)
   * 2. Compute a scale factor within the bounds into the canvas with padding
   * 3. Compute offsets to center the curve in the canvas
   */
  function calculateBoundaries() {
    if (skeleton.length === 0) {
      return;
    }

    const first = skeleton[0]!;
    let minX = first.x,
      maxX = first.x,
      minY = first.y,
      maxY = first.y;
    for (const p of skeleton) {
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

    const width = maxX - minX;
    const height = maxY - minY;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const scaleX = canvasWidth / (width * (1 + FIT_PADDING * 2));
    const scaleY = canvasHeight / (height * (1 + FIT_PADDING * 2));
    scale = Math.min(scaleX, scaleY);

    const boundsWidth = width * scale;
    const boundsHeight = height * scale;
    offsetX = (canvasWidth - boundsWidth) / 2 - minX * scale;
    offsetY = (canvasHeight - boundsHeight) / 2 - minY * scale;
  }

  function transformCoordinateToPixel(p: Point) {
    return {
      x: p.x * scale + offsetX,
      y: p.y * scale + offsetY,
    };
  }

  function drawSkeleton() {
    if (skeleton.length < 2) {
      return;
    }

    ctx.strokeStyle = hexToRgba(opts.skeletonColor, DEFAULT_SKELETON_OPACITY);
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const firstPixel = transformCoordinateToPixel(skeleton[0]!);
    ctx.moveTo(firstPixel.x, firstPixel.y);

    for (let i = 1; i < skeleton.length; i++) {
      const pixel = transformCoordinateToPixel(skeleton[i]!);
      ctx.lineTo(pixel.x, pixel.y);
    }

    ctx.stroke();
  }

  function drawTrail() {
    if (trail.length < 2) {
      return;
    }

    for (let b = 0; b < trail.length - 1; b += TRAIL_BATCH_SIZE) {
      const bEnd = Math.min(b + TRAIL_BATCH_SIZE, trail.length - 1);
      /** Normalized position of this batch along the trail (0 = tail, 1 = head) */
      const progress = (b + bEnd) / 2 / (trail.length - 1);
      const alpha = Math.pow(progress, TRAIL_FADE_CURVE) * TRAIL_MAX_OPACITY;
      const lineWidth = TRAIL_MIN_WIDTH + progress * (TRAIL_MAX_WIDTH - TRAIL_MIN_WIDTH);

      ctx.beginPath();
      for (let i = b; i <= bEnd; i++) {
        const pixel = transformCoordinateToPixel(trail[i]!);
        if (i === b) {
          ctx.moveTo(pixel.x, pixel.y);
        } else {
          ctx.lineTo(pixel.x, pixel.y);
        }
      }

      ctx.strokeStyle = hexToRgba(opts.trailColor, alpha);
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  function drawHead() {
    if (!head) {
      return;
    }

    const { x, y } = transformCoordinateToPixel(head);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, opts.glowSize);
    gradient.addColorStop(0, opts.headColor);
    gradient.addColorStop(GLOW_INNER_EDGE, hexToRgba(opts.headColor, GLOW_FALLOFF_OPACITY));
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, opts.glowSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = opts.headColor;
    ctx.beginPath();
    ctx.arc(x, y, opts.headRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const now = performance.now();
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    trail = engine.tick(deltaTime);
    head = trail.length > 0 ? trail[trail.length - 1]! : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawSkeleton();
    drawTrail();
    drawHead();

    animationId = requestAnimationFrame(render);
  }

  // Initialize skeleton on creation
  skeleton = engine.getSarmalSkeleton();
  calculateBoundaries();

  return {
    start() {
      if (animationId !== null) {
        return;
      }

      lastTime = performance.now();
      render();
    },

    stop() {
      if (animationId === null) {
        return;
      }
      cancelAnimationFrame(animationId);
      animationId = null;
    },

    reset() {
      engine.reset();
      trail = [];
      head = null;
    },

    destroy() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },
  };
}
