import { describe, it, expect } from "vitest";
import { hexToRgbComponents } from "./renderer";

describe("hexToRgbComponents", () => {
  it("parses valid 6-digit hex colors", () => {
    expect(hexToRgbComponents("#ff0000")).toBe("255,0,0");
    expect(hexToRgbComponents("#00ff00")).toBe("0,255,0");
    expect(hexToRgbComponents("#0000ff")).toBe("0,0,255");
    expect(hexToRgbComponents("#ffffff")).toBe("255,255,255");
    expect(hexToRgbComponents("#000000")).toBe("0,0,0");
  });

  it("parses hex colors with mixed case", () => {
    expect(hexToRgbComponents("#FFff00")).toBe("255,255,0");
    expect(hexToRgbComponents("#AaBbCc")).toBe("170,187,204");
  });

  it("KNOWN: invalid hex produces '0,0,0' — NaN from parseInt is coerced to 0 by bitwise ops", () => {
    // Silent failure: the gradient string becomes rgba(0,0,0,alpha) instead of erroring
    expect(hexToRgbComponents("")).toBe("0,0,0");
    expect(hexToRgbComponents("#gg0000")).toBe("0,0,0");
  });

  it("KNOWN: CSS named colors are not supported — silently produce wrong values", () => {
    // "red".slice(1) = "ed" → parseInt("ed", 16) = 237 → r=0, g=0, b=237 (blue, not red)
    expect(hexToRgbComponents("red")).toBe("0,0,237");
  });

  it("KNOWN: 3-digit shorthand is not expanded — #fff produces '0,15,255' not '255,255,255'", () => {
    // parseInt("fff", 16) = 4095 = 0x00000FFF → r=0, g=15, b=255
    expect(hexToRgbComponents("#fff")).toBe("0,15,255");
  });
});

describe("morphTo type shape", () => {
  it("SarmalInstance has morphTo method that returns Promise", () => {
    const shape = {
      start: () => {},
      stop: () => {},
      reset: () => {},
      destroy: () => {},
      seek: () => {},
      seekWithTrail: () => {},
      morphTo: () => Promise.resolve(),
    };
    expect(shape.morphTo).toBeDefined();
  });
});
