// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSetSpeed = vi.fn();
const mockInstance = { setSpeed: mockSetSpeed };

vi.mock("./index", () => ({
  createSarmal: vi.fn(() => mockInstance),
  createSplineCurve: vi.fn(() => "mocked-spline"),
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

describe("auto-init", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockSetSpeed.mockClear();
    vi.resetModules();
  });

  it("calls setSpeed when data-speed is present", async () => {
    makeCanvas("rose3", { "data-speed": "0.3" });

    const { init } = await import("./auto-init");
    init();

    expect(mockSetSpeed).toHaveBeenCalledOnce();
    expect(mockSetSpeed).toHaveBeenCalledWith(0.3);
  });

  it("does not call setSpeed when data-speed is absent", async () => {
    makeCanvas("rose3");

    const { init } = await import("./auto-init");
    init();

    expect(mockSetSpeed).not.toHaveBeenCalled();
  });

  it("initializes custom curve when data-points is present", async () => {
    const { createSarmal, createSplineCurve } = await import("./index");
    makeCanvas("custom", { "data-points": "[[100,100],[300,100]]" });

    const { init } = await import("./auto-init");
    init();

    expect(createSplineCurve).toHaveBeenCalledOnce();
    expect(createSarmal).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), "mocked-spline", expect.any(Object));
  });
});
