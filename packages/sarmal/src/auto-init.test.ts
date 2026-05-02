// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetSpeedCanvas = vi.fn();
const mockSetSpeedSvg = vi.fn();
const mockInstanceCanvas = { setSpeed: mockSetSpeedCanvas };
const mockInstanceSvg = { setSpeed: mockSetSpeedSvg };

const mockCreateSarmal = vi.fn(() => mockInstanceCanvas);
const mockCreateSarmalSvg = vi.fn(() => mockInstanceSvg);

vi.mock("./index", () => ({
  createSarmal: mockCreateSarmal,
  createSarmalSVG: mockCreateSarmalSvg,
}));

vi.mock("./curves", () => ({
  curves: {
    rose3: { name: "rose3", fn: () => ({ x: 0, y: 0 }), period: Math.PI * 2, speed: 1 },
  },
}));

// Mock OffscreenCanvas — jsdom does not provide it
class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    return {} as unknown as OffscreenCanvasRenderingContext2D;
  }
}
// @ts-ignore
globalThis.OffscreenCanvas = MockOffscreenCanvas;

function makeCanvas(curve: string, attrs: Record<string, string> = {}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("data-sarmal", curve);
  for (const [k, v] of Object.entries(attrs)) {
    canvas.setAttribute(k, v);
  }
  document.body.appendChild(canvas);
  return canvas;
}

function makeSVG(curve: string, attrs: Record<string, string> = {}): SVGSVGElement {
  const svg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  ) as unknown as SVGSVGElement;
  svg.setAttribute("data-sarmal", curve);
  for (const [k, v] of Object.entries(attrs)) {
    svg.setAttribute(k, v);
  }
  document.body.appendChild(svg);
  return svg;
}

describe("auto-init", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockSetSpeedCanvas.mockClear();
    mockSetSpeedSvg.mockClear();
    mockCreateSarmal.mockClear();
    mockCreateSarmalSvg.mockClear();
    vi.resetModules();
  });

  describe("canvas elements", () => {
    it("calls setSpeed when data-speed is present", async () => {
      makeCanvas("rose3", { "data-speed": "0.3" });

      const { init } = await import("./auto-init");
      init();

      expect(mockSetSpeedCanvas).toHaveBeenCalledOnce();
      expect(mockSetSpeedCanvas).toHaveBeenCalledWith(0.3);
    });

    it("does not call setSpeed when data-speed is absent", async () => {
      makeCanvas("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockSetSpeedCanvas).not.toHaveBeenCalled();
    });

    it("calls createSarmal, not createSarmalSVG", async () => {
      makeCanvas("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledOnce();
      expect(mockCreateSarmalSvg).not.toHaveBeenCalled();
    });
  });

  describe("SVG elements", () => {
    it("calls createSarmalSVG, not createSarmal", async () => {
      makeSVG("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalSvg).toHaveBeenCalledOnce();
      expect(mockCreateSarmal).not.toHaveBeenCalled();
    });

    it("calls setSpeed when data-speed is present", async () => {
      makeSVG("rose3", { "data-speed": "0.5" });

      const { init } = await import("./auto-init");
      init();

      expect(mockSetSpeedSvg).toHaveBeenCalledOnce();
      expect(mockSetSpeedSvg).toHaveBeenCalledWith(0.5);
    });

    it("does not call setSpeed when data-speed is absent", async () => {
      makeSVG("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockSetSpeedSvg).not.toHaveBeenCalled();
    });

    it("passes trailColor to createSarmalSVG", async () => {
      makeSVG("rose3", { "data-trail-color": "#ff0000" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ trailColor: "#ff0000" }),
      );
    });
  });

  describe("mixed elements", () => {
    it("handles both canvas and SVG in the same init call", async () => {
      makeCanvas("rose3");
      makeSVG("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledOnce();
      expect(mockCreateSarmalSvg).toHaveBeenCalledOnce();
    });
  });

  describe("unsupported elements", () => {
    it("does not match div[data-sarmal]", async () => {
      const div = document.createElement("div");
      div.setAttribute("data-sarmal", "rose3");
      document.body.appendChild(div);

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).not.toHaveBeenCalled();
      expect(mockCreateSarmalSvg).not.toHaveBeenCalled();
    });
  });
});
