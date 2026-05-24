// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetSpeedCanvas = vi.fn();
const mockSetSpeedSvg = vi.fn();
const mockSetSpeedDotMatrix = vi.fn();
const mockInstanceCanvas = { setSpeed: mockSetSpeedCanvas };
const mockInstanceSvg = { setSpeed: mockSetSpeedSvg };
const mockInstanceDotMatrix = { setSpeed: mockSetSpeedDotMatrix };

const mockCreateSarmal = vi.fn(() => mockInstanceCanvas);
const mockCreateSarmalSvg = vi.fn(() => mockInstanceSvg);
const mockCreateSarmalDotMatrix = vi.fn(() => mockInstanceDotMatrix);

vi.mock("./index", () => ({
  createSarmal: mockCreateSarmal,
  createSarmalSVG: mockCreateSarmalSvg,
  createSarmalDotMatrix: mockCreateSarmalDotMatrix,
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
    mockSetSpeedDotMatrix.mockClear();
    mockCreateSarmal.mockClear();
    mockCreateSarmalSvg.mockClear();
    mockCreateSarmalDotMatrix.mockClear();
    vi.resetModules();
  });

  describe("canvas elements", () => {
    it("calls createSarmal, not createSarmalSVG or createSarmalDotMatrix", async () => {
      makeCanvas("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledOnce();
      expect(mockCreateSarmalSvg).not.toHaveBeenCalled();
      expect(mockCreateSarmalDotMatrix).not.toHaveBeenCalled();
    });

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

    it("passes trailColor to createSarmal", async () => {
      makeCanvas("rose3", { "data-trail-color": "#ff0000" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ trailColor: "#ff0000" }),
      );
    });

    it("passes trailWidth to createSarmal", async () => {
      makeCanvas("rose3", { "data-trail-width": "1.5" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ trailWidth: 1.5 }),
      );
    });

    it("passes autoStart: false when data-auto-start is 'false'", async () => {
      makeCanvas("rose3", { "data-auto-start": "false" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ autoStart: false }),
      );
    });

    it("does not pass autoStart when data-auto-start is absent", async () => {
      makeCanvas("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ autoStart: expect.anything() }),
      );
    });

    it("passes initialPhase to createSarmal", async () => {
      makeCanvas("rose3", { "data-initial-phase": "1.57" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ initialPhase: 1.57 }),
      );
    });

    it("passes initialPhase: 0 when data-initial-phase is '0'", async () => {
      makeCanvas("rose3", { "data-initial-phase": "0" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ initialPhase: 0 }),
      );
    });
  });

  describe("SVG elements", () => {
    it("calls createSarmalSVG, not createSarmal or createSarmalDotMatrix", async () => {
      makeSVG("rose3");

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalSvg).toHaveBeenCalledOnce();
      expect(mockCreateSarmal).not.toHaveBeenCalled();
      expect(mockCreateSarmalDotMatrix).not.toHaveBeenCalled();
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

    it("passes trailWidth to createSarmalSVG", async () => {
      makeSVG("rose3", { "data-trail-width": "2" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ trailWidth: 2 }),
      );
    });

    it("passes autoStart: false when data-auto-start is 'false'", async () => {
      makeSVG("rose3", { "data-auto-start": "false" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ autoStart: false }),
      );
    });

    it("passes initialPhase: 0 when data-initial-phase is '0'", async () => {
      makeSVG("rose3", { "data-initial-phase": "0" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalSvg).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ initialPhase: 0 }),
      );
    });
  });

  describe("dot matrix renderer", () => {
    it("routes canvas[data-renderer='dot-matrix'] to createSarmalDotMatrix", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledOnce();
      expect(mockCreateSarmal).not.toHaveBeenCalled();
      expect(mockCreateSarmalSvg).not.toHaveBeenCalled();
    });

    it("calls setSpeed on the dot matrix instance when data-speed is present", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-speed": "2" });

      const { init } = await import("./auto-init");
      init();

      expect(mockSetSpeedDotMatrix).toHaveBeenCalledOnce();
      expect(mockSetSpeedDotMatrix).toHaveBeenCalledWith(2);
    });

    it("passes cols to createSarmalDotMatrix", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-cols": "16" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ cols: 16 }),
      );
    });

    it("passes rows to createSarmalDotMatrix", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-rows": "24" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ rows: 24 }),
      );
    });

    it("passes roundness to createSarmalDotMatrix", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-roundness": "0.5" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ roundness: 0.5 }),
      );
    });

    it("passes trailColor to createSarmalDotMatrix", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-trail-color": "#00ff00" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ trailColor: "#00ff00" }),
      );
    });

    it("passes autoStart: false when data-auto-start is 'false'", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-auto-start": "false" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ autoStart: false }),
      );
    });

    it("passes initialPhase: 0 when data-initial-phase is '0'", async () => {
      makeCanvas("rose3", { "data-renderer": "dot-matrix", "data-initial-phase": "0" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ initialPhase: 0 }),
      );
    });
  });

  describe("mixed elements", () => {
    it("handles canvas, SVG, and dot-matrix canvas in the same init call", async () => {
      makeCanvas("rose3");
      makeSVG("rose3");
      makeCanvas("rose3", { "data-renderer": "dot-matrix" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledOnce();
      expect(mockCreateSarmalSvg).toHaveBeenCalledOnce();
      expect(mockCreateSarmalDotMatrix).toHaveBeenCalledOnce();
    });
  });

  describe("data-renderer routing", () => {
    it("routes canvas with explicit data-renderer='canvas' to createSarmal", async () => {
      makeCanvas("rose3", { "data-renderer": "canvas" });

      const { init } = await import("./auto-init");
      init();

      expect(mockCreateSarmal).toHaveBeenCalledOnce();
      expect(mockCreateSarmalDotMatrix).not.toHaveBeenCalled();
    });

    it("errors and skips on an unknown data-renderer value", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      makeCanvas("rose3", { "data-renderer": "typo" });

      const { init } = await import("./auto-init");
      init();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('"typo"'));
      expect(mockCreateSarmal).not.toHaveBeenCalled();
      expect(mockCreateSarmalDotMatrix).not.toHaveBeenCalled();
      errorSpy.mockRestore();
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
      expect(mockCreateSarmalDotMatrix).not.toHaveBeenCalled();
    });
  });
});
