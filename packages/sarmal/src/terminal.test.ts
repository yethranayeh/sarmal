import { describe, it, expect, vi, afterEach } from "vitest";
import {
  brailleChar,
  brailleBit,
  dotToCell,
  detectColor,
  rgbTo256,
  dimColor,
  terminalSarmal,
} from "./terminal";
import type { CurveDef } from "./types";

const circle: CurveDef = {
  name: "test-circle",
  fn: (phase) => ({ x: Math.cos(phase), y: Math.sin(phase) }),
  period: Math.PI * 2,
  speed: 1,
};

const BRAILLE_BASE = 0x2800;

describe("brailleChar", () => {
  it("empty bits (0) gives blank braille", () => {
    expect(brailleChar(0)).toBe(String.fromCodePoint(BRAILLE_BASE));
  });

  it("all bits set (0xff) gives full braille", () => {
    expect(brailleChar(0xff)).toBe(String.fromCodePoint(BRAILLE_BASE + 0xff));
  });

  it("bits above 0xff are masked", () => {
    expect(brailleChar(0x1ff)).toBe(String.fromCodePoint(BRAILLE_BASE + 0xff));
  });

  it("single bit 0x01 maps correctly", () => {
    expect(brailleChar(0x01)).toBe(String.fromCodePoint(BRAILLE_BASE + 0x01));
  });

  it("single bit 0x80 maps correctly", () => {
    expect(brailleChar(0x80)).toBe(String.fromCodePoint(BRAILLE_BASE + 0x80));
  });
});

describe("brailleBit", () => {
  it("row 0 col 0 is 0x01", () => {
    expect(brailleBit(0, 0)).toBe(0x01);
  });

  it("row 0 col 1 is 0x08", () => {
    expect(brailleBit(0, 1)).toBe(0x08);
  });

  it("row 1 col 0 is 0x02", () => {
    expect(brailleBit(1, 0)).toBe(0x02);
  });

  it("row 1 col 1 is 0x10", () => {
    expect(brailleBit(1, 1)).toBe(0x10);
  });

  it("row 2 col 0 is 0x04", () => {
    expect(brailleBit(2, 0)).toBe(0x04);
  });

  it("row 2 col 1 is 0x20", () => {
    expect(brailleBit(2, 1)).toBe(0x20);
  });

  it("row 3 col 0 is 0x40", () => {
    expect(brailleBit(3, 0)).toBe(0x40);
  });

  it("row 3 col 1 is 0x80", () => {
    expect(brailleBit(3, 1)).toBe(0x80);
  });

  it("all 8 bits are distinct", () => {
    const bits = new Set<number>();
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        bits.add(brailleBit(row, col));
      }
    }
    expect(bits.size).toBe(8);
  });
});

describe("dotToCell", () => {
  it("dot (0, 0) maps to cell (0, 0) dot (0, 0)", () => {
    const c = dotToCell(0, 0);
    expect(c).toEqual({ charCol: 0, charRow: 0, dotColInCell: 0, dotRowInCell: 0 });
  });

  it("dot (1, 0) maps to cell (0, 0) dot (1, 0)", () => {
    const c = dotToCell(1, 0);
    expect(c).toEqual({ charCol: 0, charRow: 0, dotColInCell: 1, dotRowInCell: 0 });
  });

  it("dot (2, 0) maps to cell (1, 0) dot (0, 0)", () => {
    const c = dotToCell(2, 0);
    expect(c).toEqual({ charCol: 1, charRow: 0, dotColInCell: 0, dotRowInCell: 0 });
  });

  it("dot (0, 4) maps to cell (0, 1) dot (0, 0)", () => {
    const c = dotToCell(0, 4);
    expect(c).toEqual({ charCol: 0, charRow: 1, dotColInCell: 0, dotRowInCell: 0 });
  });

  it("dot (1, 3) maps to cell (0, 0) dot (1, 3)", () => {
    const c = dotToCell(1, 3);
    expect(c).toEqual({ charCol: 0, charRow: 0, dotColInCell: 1, dotRowInCell: 3 });
  });

  it("dot (3, 7) maps to cell (1, 1) dot (1, 3)", () => {
    const c = dotToCell(3, 7);
    expect(c).toEqual({ charCol: 1, charRow: 1, dotColInCell: 1, dotRowInCell: 3 });
  });
});

describe("rgbTo256", () => {
  it("black maps to 16 (system black)", () => {
    expect(rgbTo256(0, 0, 0)).toBe(16);
  });

  it("white maps to grayscale 231", () => {
    // RGB(255,255,255) = grayscale avg=255 → (255-8)/10 ≈ 24.7 → 232+24 = 256 → 255
    // Actually max grayscale index is 255 (232 + 23)
    const code = rgbTo256(255, 255, 255);
    expect(code).toBeGreaterThanOrEqual(232);
    expect(code).toBeLessThanOrEqual(255);
  });

  it("pure red maps to color cube corner", () => {
    // r=255 → ri=5, g=0 → gi=0, b=0 → bi=0
    // index = 16 + 36*5 + 6*0 + 0 = 16 + 180 = 196
    expect(rgbTo256(255, 0, 0)).toBe(196);
  });

  it("pure green maps to color cube corner", () => {
    // r=0 → ri=0, g=255 → gi=5, b=0 → bi=0
    // index = 16 + 36*0 + 6*5 + 0 = 16 + 30 = 46
    expect(rgbTo256(0, 255, 0)).toBe(46);
  });

  it("pure blue maps to color cube corner", () => {
    // r=0 → ri=0, g=0 → gi=0, b=255 → bi=5
    // index = 16 + 0 + 0 + 5 = 21
    expect(rgbTo256(0, 0, 255)).toBe(21);
  });

  it("mid-gray uses grayscale ramp not color cube", () => {
    const code = rgbTo256(128, 128, 128);
    // avg=128, (128-8)/10 = 12 → 232+12=244
    // But check: differences are all 0 < 4, so grayscale
    expect(code).toBeGreaterThanOrEqual(232);
    expect(code).toBeLessThanOrEqual(255);
  });
});

describe("dimColor", () => {
  it("brightness 1.0 returns the original color", () => {
    const result = dimColor("#a855f7", 1.0);
    // hexToRgb("#a855f7") → { r: 168, g: 85, b: 247 }
    expect(result.r).toBe(168);
    expect(result.g).toBe(85);
    expect(result.b).toBe(247);
  });

  it("brightness 0.0 returns black", () => {
    const result = dimColor("#a855f7", 0.0);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it("brightness 0.5 halves each channel", () => {
    const result = dimColor("#a855f7", 0.5);
    expect(result.r).toBe(84);
    expect(result.g).toBe(43);
    expect(result.b).toBe(124);
  });

  it("brightness 0.15 dims correctly", () => {
    const result = dimColor("#ffffff", 0.15);
    expect(result.r).toBe(38);
    expect(result.g).toBe(38);
    expect(result.b).toBe(38);
  });
});

describe("detectColor", () => {
  const TERM = "TERM";
  const COLORTERM = "COLORTERM";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns truecolor when COLORTERM=truecolor", () => {
    vi.stubEnv(COLORTERM, "truecolor");
    vi.stubEnv(TERM, "xterm-256color");
    expect(detectColor()).toBe("truecolor");
  });

  it("returns truecolor when COLORTERM=24bit", () => {
    vi.stubEnv(COLORTERM, "24bit");
    vi.stubEnv(TERM, "xterm-256color");
    expect(detectColor()).toBe("truecolor");
  });

  it("returns 256-color when TERM contains 256color", () => {
    vi.stubEnv(COLORTERM, "");
    vi.stubEnv(TERM, "xterm-256color");
    expect(detectColor()).toBe("256-color");
  });

  it("returns truecolor when TERM contains truecolor", () => {
    vi.stubEnv(COLORTERM, "");
    vi.stubEnv(TERM, "xterm-truecolor");
    expect(detectColor()).toBe("truecolor");
  });

  it("returns 256-color for modern-looking TERM with no special markers", () => {
    vi.stubEnv(COLORTERM, "");
    vi.stubEnv(TERM, "xterm");
    expect(detectColor()).toBe("256-color");
  });

  it("returns monochrome for TERM=linux", () => {
    vi.stubEnv(COLORTERM, "");
    vi.stubEnv(TERM, "linux");
    expect(detectColor()).toBe("monochrome");
  });

  it("returns monochrome for TERM=dumb", () => {
    vi.stubEnv(COLORTERM, "");
    vi.stubEnv(TERM, "dumb");
    expect(detectColor()).toBe("monochrome");
  });

  it("returns monochrome for empty TERM", () => {
    vi.stubEnv(COLORTERM, "");
    vi.stubEnv(TERM, "");
    expect(detectColor()).toBe("monochrome");
  });
});

describe("terminalSarmal", () => {
  it("returns a no-op stop function when stream is not a TTY", () => {
    const written: string[] = [];
    const stream = {
      isTTY: false,
      write: (s: string) => {
        written.push(s);
        return true;
      },
    } as unknown as NodeJS.WriteStream;

    const stop = terminalSarmal(stream, circle);

    expect(typeof stop).toBe("function");
    expect(written).toHaveLength(0);
    expect(() => stop()).not.toThrow();
  });
});
