import type { CurveDef } from "./types";
import type { Rgb } from "./renderer-shared";

import { createEngine } from "./engine";
import {
  computeBoundaries,
  lerpOklab,
  parseColorToRgb,
  rgbToOklab,
  oklabToRgb,
} from "./renderer-shared";

const DEFAULT_TRAIL_HEX = "#ec5571"; // --color-primary
const DEFAULT_FPS = 30;
const DEFAULT_SIZE = 16; // visual-tested at 12/16/20/24 chars; 16 was the smallest that showed clear curve definition
const BRIGHTNESS_HEAD = 1.0;
const BRIGHTNESS_TAIL = 0.15;
const BRAILLE_BASE = 0x2800;

type BrailleBit = [number, number];

/**
 * ! 0x40 and 0x80 are not unused. My LLM said `Omitting them reduces the grid to 2×3 and loses a quarter of the resolution`
 * ! Simple mode with one char per cell does not produce high enough fidelity, so Braille is the preffered approach.
 */
const BRAILLE_BIT: Array<BrailleBit> = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

export type ColorCapability = "truecolor" | "256-color" | "monochrome";
type DotCol = 0 | 1;
type DotRow = 0 | 1 | 2 | 3;
type Boundary = { screenX: number; screenY: number };

export interface TerminalSarmalOptions {
  size?: number;
  fps?: number;
  trailColor?: string;
  headColor?: string;
  speed?: number;
}

export function brailleChar(bits: number) {
  return String.fromCodePoint(BRAILLE_BASE + (bits & 0xff));
}

export function brailleBit(row: number, col: number) {
  if (row < 0 || row >= BRAILLE_BIT.length || col < 0 || col >= (BRAILLE_BIT[0]?.length ?? 0)) {
    return 0;
  }
  return BRAILLE_BIT[row]![col]!;
}

export function dotToCell(
  dotCol: number,
  dotRow: number,
): {
  charCol: number;
  charRow: number;
  dotColInCell: DotCol;
  dotRowInCell: DotRow;
} {
  return {
    charCol: Math.floor(dotCol / 2),
    charRow: Math.floor(dotRow / 4),
    dotColInCell: (dotCol % 2) as DotCol,
    dotRowInCell: (dotRow % 4) as DotRow,
  };
}

export function detectColor(): ColorCapability {
  const colorterm = (process.env.COLORTERM ?? "").toLowerCase();

  if (colorterm === "truecolor" || colorterm === "24bit") {
    return "truecolor";
  }

  const term = (process.env.TERM ?? "").toLowerCase();

  if (term.includes("256color")) {
    return "256-color";
  }

  if (term.includes("truecolor") || term.includes("24bit")) {
    return "truecolor";
  }

  if (term === "" || term === "linux" || term === "dumb") {
    return "monochrome";
  }

  return "256-color";
}

export function rgbTo256(r: number, g: number, b: number) {
  const avg = Math.round((r + g + b) / 3);

  if (Math.abs(r - avg) <= 4 && Math.abs(g - avg) <= 4 && Math.abs(b - avg) <= 4) {
    if (avg <= 8) {
      return 16;
    }
    return 232 + Math.min(23, Math.round((avg - 8) / 10));
  }

  const ri = Math.round((r / 255) * 5);
  const gi = Math.round((g / 255) * 5);
  const bi = Math.round((b / 255) * 5);
  return 16 + 36 * ri + 6 * gi + bi;
}

export function dimRgb(rgb: Rgb, brightness: number): Rgb {
  const t = 1 - Math.max(0, Math.min(1, brightness));
  if (t <= 0) return rgb;
  if (t >= 1) return { r: 0, g: 0, b: 0 };
  return oklabToRgb(lerpOklab(rgbToOklab(rgb), { L: 0, a: 0, b: 0 }, t));
}

export function dimColor(color: string, brightness: number): Rgb {
  return dimRgb(parseColorToRgb(color)!, brightness);
}

const AR = "\x1B[0m";

function ansiTruecolorFg(r: number, g: number, b: number) {
  return `\x1B[38;2;${r};${g};${b}m`;
}

function ansi256Fg(code: number) {
  return `\x1B[38;5;${code}m`;
}

function ansiColor(r: number, g: number, b: number, colorCap: ColorCapability) {
  if (colorCap === "truecolor") {
    return ansiTruecolorFg(r, g, b);
  }

  if (colorCap === "256-color") {
    return ansi256Fg(rgbTo256(r, g, b));
  }

  return "";
}

interface BrailleCell {
  bits: number;
  brightness: number;
  isHead: boolean;
}

function snapCol(col: number, max: number) {
  return Math.max(0, Math.min(max - 1, Math.round(col)));
}

function applyBoundary(
  x: number,
  y: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): Boundary {
  return {
    screenX: x * scale + offsetX,
    screenY: y * scale + offsetY,
  };
}

function renderFrame(
  trail: Array<{ x: number; y: number }>,
  trailCount: number,
  charWidth: number,
  charHeight: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  trailRgb: Rgb,
  headRgb: Rgb,
  colorCap: ColorCapability,
): string {
  const dotWidth = charWidth * 2;
  const dotHeight = charHeight * 4;

  const grid: BrailleCell[][] = Array.from({ length: charHeight }, () =>
    Array.from(
      { length: charWidth },
      (): BrailleCell => ({ bits: 0, brightness: 0, isHead: false }),
    ),
  );

  for (let i = 0; i < trailCount; i++) {
    const pt = trail[i]!;
    const t = trailCount > 1 ? i / (trailCount - 1) : 1;
    const brightness = BRIGHTNESS_TAIL + (BRIGHTNESS_HEAD - BRIGHTNESS_TAIL) * t;
    const { screenX, screenY } = applyBoundary(pt.x, pt.y, scale, offsetX, offsetY);
    const dotCol = snapCol(screenX, dotWidth);
    const dotRow = snapCol(screenY, dotHeight);
    const cell = dotToCell(dotCol, dotRow);

    if (
      cell.charRow < 0 ||
      cell.charRow >= charHeight ||
      cell.charCol < 0 ||
      cell.charCol >= charWidth
    ) {
      continue;
    }

    const c = grid[cell.charRow]![cell.charCol]!;
    c.bits |= BRAILLE_BIT[cell.dotRowInCell]![cell.dotColInCell]!;
    if (brightness > c.brightness) {
      c.brightness = brightness;
    }

    if (i === trailCount - 1) {
      c.isHead = true;
    }
  }

  if (colorCap !== "monochrome") {
    return renderColorFrame(grid, charWidth, charHeight, trailRgb, headRgb, colorCap);
  }

  return renderMonochromeFrame(grid, charWidth, charHeight);
}

function renderColorFrame(
  grid: BrailleCell[][],
  charWidth: number,
  charHeight: number,
  trailRgb: Rgb,
  headRgb: Rgb,
  colorCap: ColorCapability,
): string {
  const lines: string[] = [];

  for (let row = 0; row < charHeight; row++) {
    let line = "";
    for (let col = 0; col < charWidth; col++) {
      const cell = grid[row]![col]!;
      if (cell.bits === 0) {
        line += " ";
        continue;
      }

      const ch = brailleChar(cell.bits);
      if (cell.isHead) {
        line += ansiColor(headRgb.r, headRgb.g, headRgb.b, colorCap) + ch + AR;
      } else {
        const dimmed = dimRgb(trailRgb, cell.brightness);
        line += ansiColor(dimmed.r, dimmed.g, dimmed.b, colorCap) + ch + AR;
      }
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function renderMonochromeFrame(
  grid: Array<Array<BrailleCell>>,
  charWidth: number,
  charHeight: number,
): string {
  const lines: string[] = [];
  for (let row = 0; row < charHeight; row++) {
    let line = "";

    for (let col = 0; col < charWidth; col++) {
      const cell = grid[row]![col]!;

      if (cell.bits === 0) {
        line += " ";
        continue;
      }

      line += brailleChar(cell.bits);
    }
    lines.push(line);
  }
  return lines.join("\n");
}

export function terminalSarmal(
  stream: NodeJS.WriteStream,
  curveDef: CurveDef,
  options?: TerminalSarmalOptions,
) {
  if (!stream.isTTY) {
    return () => {};
  }

  const size = options?.size ?? DEFAULT_SIZE;
  const fps = options?.fps ?? DEFAULT_FPS;
  const trailHex = options?.trailColor ?? DEFAULT_TRAIL_HEX;
  const headHex = options?.headColor ?? trailHex;
  const userSpeed = options?.speed;
  const colorCap = detectColor();

  const trailRgb = parseColorToRgb(trailHex)!;
  const headRgb = parseColorToRgb(headHex)!;

  const engine = createEngine(curveDef);
  if (userSpeed !== undefined) {
    engine.setSpeed(userSpeed);
  }

  const charWidth = size;
  const charHeight = Math.ceil(size / 2);

  const skeleton = engine.getSarmalSkeleton();
  const b = computeBoundaries(skeleton, charWidth * 2, charHeight * 4, 1);
  if (!b) {
    return () => {};
  }

  const { scale, offsetX, offsetY } = b;

  let running = true;
  let firstFrame = true;

  stream.write("\x1B[?25l");

  function cleanup() {
    running = false;
    stream.write("\x1B[?25h");
    stream.write("\n");
  }

  const onSigint = () => {
    cleanup();
    process.exit(0);
  };
  process.on("SIGINT", onSigint);

  function render() {
    const delta = 1 / fps;
    const trail = engine.tick(delta);
    const trailCount = engine.trailCount;

    const frame = renderFrame(
      trail,
      trailCount,
      charWidth,
      charHeight,
      scale,
      offsetX,
      offsetY,
      trailRgb,
      headRgb,
      colorCap,
    );

    if (firstFrame) {
      firstFrame = false;
      stream.write(frame + "\n");
      return;
    }

    const rows = charHeight;
    stream.write(`\x1B[${rows}A`);
    const lines = frame.split("\n");
    for (const line of lines) {
      stream.write(line + "\n");
    }
  }

  render();

  const interval = setInterval(() => {
    if (!running) {
      return;
    }

    render();
  }, 1000 / fps);

  function stop() {
    clearInterval(interval);
    process.off("SIGINT", onSigint);
    cleanup();
  }

  return stop;
}
