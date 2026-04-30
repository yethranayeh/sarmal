import type { CurveDef } from "@sarmal/core";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

import { useSarmal, Sarmal, useSarmalSVG, SarmalSVG } from "./index";

const circle: CurveDef = {
  name: "test-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: Math.PI * 2,
  speed: 1,
};

const square: CurveDef = {
  name: "test-square",
  fn: (t) => ({ x: Math.cos(t) * 0.5, y: Math.sin(t) * 0.5 }),
  period: Math.PI * 2,
  speed: 1,
};

// Single shared mock instance — never recreated. Tests clear call history only.
const mockInstance = {
  play: vi.fn(),
  pause: vi.fn(),
  reset: vi.fn(),
  destroy: vi.fn(),
  jump: vi.fn(),
  seek: vi.fn(),
  setSpeed: vi.fn(),
  getSpeed: vi.fn(() => 1),
  resetSpeed: vi.fn(),
  setSpeedOver: vi.fn(() => Promise.resolve()),
  morphTo: vi.fn(() => Promise.resolve()),
  setRenderOptions: vi.fn(),
};

vi.mock("@sarmal/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sarmal/core")>();
  return {
    ...actual,
    createSarmal: vi.fn(() => mockInstance),
    createSarmalSVG: vi.fn(() => mockInstance),
  };
});

import { createSarmal, createSarmalSVG } from "@sarmal/core";
const mockCreateSarmal = vi.mocked(createSarmal);
const mockCreateSarmalSVG = vi.mocked(createSarmalSVG);

describe("useSarmal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  function TestHarness({
    curve,
    init,
    morphOptions,
  }: {
    curve: CurveDef;
    init?: {
      width?: number;
      height?: number;
      trailLength?: number;
      headRadius?: number;
      autoStart?: boolean;
      initialT?: number;
    };
    morphOptions?: { morphDuration?: number };
  }) {
    const { canvasRef, instance } = useSarmal(curve, { trailColor: "#ff0000" }, init, morphOptions);
    return (
      <canvas
        ref={canvasRef}
        data-testid="canvas"
        data-instance={instance.current ? "true" : "false"}
      />
    );
  }

  it("creates a sarmal instance on mount", () => {
    render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);
    const canvas = screen.getByTestId("canvas");

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      trailColor: "#ff0000",
    });
  });

  it("calls destroy on unmount", () => {
    const { unmount } = render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);

    unmount();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not recreate when runtime options change", () => {
    const { rerender } = render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
  });

  it("morphs when curve reference changes", () => {
    const { rerender } = render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);

    rerender(<TestHarness curve={square} init={{ width: 200, height: 200 }} />);

    expect(mockInstance.morphTo).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, undefined);
  });

  it("forwards morphDuration to morphTo when curve changes", () => {
    const { rerender } = render(
      <TestHarness
        curve={circle}
        init={{ width: 200, height: 200 }}
        morphOptions={{ morphDuration: 500 }}
      />,
    );

    rerender(
      <TestHarness
        curve={square}
        init={{ width: 200, height: 200 }}
        morphOptions={{ morphDuration: 500 }}
      />,
    );

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 500,
    });
  });

  it("does not call morphTo on first render", () => {
    render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);

    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });

  it("swallows morphTo rejection (destroy called mid-morph)", async () => {
    mockInstance.morphTo.mockRejectedValueOnce(new Error("Instance destroyed during morph"));
    const { rerender } = render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);

    // should not throw or produce an unhandled rejection
    rerender(<TestHarness curve={square} init={{ width: 200, height: 200 }} />);
  });

  it("does not call morphTo on StrictMode remount with the same curve", () => {
    render(
      <React.StrictMode>
        <TestHarness curve={circle} init={{ width: 200, height: 200 }} />
      </React.StrictMode>,
    );

    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });

  it("sets canvas width and height from init options", () => {
    render(<TestHarness curve={circle} init={{ width: 400, height: 300 }} />);
    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
  });

  it("falls back to 300x300 and warns when parent has zero dimensions", () => {
    const warn = vi.spyOn(console, "warn");

    render(<TestHarness curve={circle} />);
    const canvas = screen.getByTestId("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(300);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Could not determine canvas dimensions/),
    );
  });

  it("destroys and recreates when width changes", () => {
    const { rerender } = render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
    expect(mockInstance.destroy).not.toHaveBeenCalled();

    rerender(<TestHarness curve={circle} init={{ width: 400, height: 200 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when height changes", () => {
    const { rerender } = render(<TestHarness curve={circle} init={{ width: 200, height: 200 }} />);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} init={{ width: 200, height: 400 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("passes trailLength from init to createSarmal", () => {
    render(<TestHarness curve={circle} init={{ width: 200, height: 200, trailLength: 60 }} />);

    expect(mockCreateSarmal).toHaveBeenCalledWith(expect.anything(), circle, {
      trailColor: "#ff0000",
      trailLength: 60,
    });
  });

  it("destroys and recreates when trailLength changes", () => {
    const { rerender } = render(
      <TestHarness curve={circle} init={{ width: 200, height: 200, trailLength: 60 }} />,
    );
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} init={{ width: 200, height: 200, trailLength: 200 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("passes headRadius from init to createSarmal", () => {
    render(<TestHarness curve={circle} init={{ width: 200, height: 200, headRadius: 10 }} />);

    expect(mockCreateSarmal).toHaveBeenCalledWith(expect.anything(), circle, {
      trailColor: "#ff0000",
      headRadius: 10,
    });
  });

  it("destroys and recreates when headRadius changes", () => {
    const { rerender } = render(
      <TestHarness curve={circle} init={{ width: 200, height: 200, headRadius: 4 }} />,
    );
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} init={{ width: 200, height: 200, headRadius: 10 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when autoStart changes", () => {
    const { rerender } = render(
      <TestHarness curve={circle} init={{ width: 200, height: 200, autoStart: true }} />,
    );
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} init={{ width: 200, height: 200, autoStart: false }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when initialT changes", () => {
    const { rerender } = render(
      <TestHarness curve={circle} init={{ width: 200, height: 200, initialT: 0 }} />,
    );
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} init={{ width: 200, height: 200, initialT: 0.5 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(2);
  });

  it("does not call setRenderOptions when init options change (they destroy+recreate instead)", () => {
    const { rerender } = render(
      <TestHarness curve={circle} init={{ width: 200, height: 200, trailLength: 60 }} />,
    );

    rerender(<TestHarness curve={circle} init={{ width: 400, height: 400, trailLength: 120 }} />);

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });
});

describe("<Sarmal>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders a canvas element", () => {
    render(<Sarmal curve={circle} width={200} height={200} />);

    expect(document.querySelector("canvas")).not.toBeNull();
  });

  it("creates a sarmal instance on mount", () => {
    render(<Sarmal curve={circle} width={200} height={200} />);

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
  });

  it("calls onReady with the instance after mount", () => {
    const onReady = vi.fn();

    render(<Sarmal curve={circle} width={200} height={200} onReady={onReady} />);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(mockInstance);
  });

  it("morphs when curve changes", () => {
    const { rerender } = render(<Sarmal curve={circle} width={200} height={200} />);

    rerender(<Sarmal curve={square} width={200} height={200} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, undefined);
  });

  it("forwards morphDuration on curve change", () => {
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} morphDuration={500} />,
    );

    rerender(<Sarmal curve={square} width={200} height={200} morphDuration={500} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 500,
    });
  });

  it("calls setRenderOptions when trailColor changes", () => {
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} trailColor="#ff0000" />,
    );

    rerender(<Sarmal curve={circle} width={200} height={200} trailColor="#00ff00" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: "#00ff00",
    });
  });

  it("does not call setRenderOptions when trailColor array is shallow-equal", () => {
    const colors = ["#ff0000", "#00ff00"];
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} trailColor={colors} />,
    );

    rerender(<Sarmal curve={circle} width={200} height={200} trailColor={colors} />);

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("calls setRenderOptions when trailColor array changes", () => {
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} trailColor={["#ff0000", "#00ff00"]} />,
    );

    rerender(
      <Sarmal curve={circle} width={200} height={200} trailColor={["#0000ff", "#ff00ff"]} />,
    );

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: ["#0000ff", "#ff00ff"],
    });
  });

  it("calls setRenderOptions when skeletonColor changes", () => {
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} skeletonColor="#ffffff" />,
    );

    rerender(<Sarmal curve={circle} width={200} height={200} skeletonColor="transparent" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      skeletonColor: "transparent",
    });
  });

  it("calls setRenderOptions when headColor changes", () => {
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} headColor="#ffffff" />,
    );

    rerender(<Sarmal curve={circle} width={200} height={200} headColor="#ff0000" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      headColor: "#ff0000",
    });
  });

  it("calls setRenderOptions when trailStyle changes", () => {
    const { rerender } = render(
      <Sarmal curve={circle} width={200} height={200} trailStyle="default" />,
    );

    rerender(<Sarmal curve={circle} width={200} height={200} trailStyle="gradient-animated" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailStyle: "gradient-animated",
    });
  });

  it("destroys instance on unmount", () => {
    const { unmount } = render(<Sarmal curve={circle} width={200} height={200} />);

    unmount();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("passes trailLength to createSarmal", () => {
    render(<Sarmal curve={circle} width={200} height={200} trailLength={60} />);

    expect(mockCreateSarmal).toHaveBeenCalledWith(expect.anything(), circle, {
      trailLength: 60,
    });
  });

  it("passes headRadius to createSarmal", () => {
    render(<Sarmal curve={circle} width={200} height={200} headRadius={10} />);

    expect(mockCreateSarmal).toHaveBeenCalledWith(expect.anything(), circle, {
      headRadius: 10,
    });
  });

  it("does not call morphTo on first render", () => {
    render(<Sarmal curve={circle} width={200} height={200} />);
    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });
});

describe("useSarmalSVG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function SVGTestHarness({
    curve,
    init,
    morphOptions,
  }: {
    curve: CurveDef;
    init?: { trailLength?: number; headRadius?: number; autoStart?: boolean; initialT?: number };
    morphOptions?: { morphDuration?: number };
  }) {
    const { svgRef, instance } = useSarmalSVG(curve, { trailColor: "#ff0000" }, init, morphOptions);
    return (
      <svg ref={svgRef} data-testid="svg" data-instance={instance.current ? "true" : "false"} />
    );
  }

  it("creates a sarmal SVG instance on mount", () => {
    render(<SVGTestHarness curve={circle} />);
    const svg = screen.getByTestId("svg");

    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(svg, circle, {
      trailColor: "#ff0000",
    });
  });

  it("calls destroy on unmount", () => {
    const { unmount } = render(<SVGTestHarness curve={circle} />);

    unmount();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("morphs when curve reference changes", () => {
    const { rerender } = render(<SVGTestHarness curve={circle} />);

    rerender(<SVGTestHarness curve={square} />);

    expect(mockInstance.morphTo).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, undefined);
  });

  it("forwards morphDuration to morphTo when curve changes", () => {
    const { rerender } = render(
      <SVGTestHarness curve={circle} morphOptions={{ morphDuration: 500 }} />,
    );

    rerender(<SVGTestHarness curve={square} morphOptions={{ morphDuration: 500 }} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 500,
    });
  });

  it("does not call morphTo on first render", () => {
    render(<SVGTestHarness curve={circle} />);

    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });

  it("sets viewBox on the SVG element", () => {
    render(<SVGTestHarness curve={circle} />);
    const svg = screen.getByTestId("svg");

    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
  });

  it("passes trailLength from init to createSarmalSVG", () => {
    render(<SVGTestHarness curve={circle} init={{ trailLength: 60 }} />);

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(expect.anything(), circle, {
      trailColor: "#ff0000",
      trailLength: 60,
    });
  });

  it("passes headRadius from init to createSarmalSVG", () => {
    render(<SVGTestHarness curve={circle} init={{ headRadius: 10 }} />);

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(expect.anything(), circle, {
      trailColor: "#ff0000",
      headRadius: 10,
    });
  });

  it("destroys and recreates when trailLength changes", () => {
    const { rerender } = render(<SVGTestHarness curve={circle} init={{ trailLength: 60 }} />);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    rerender(<SVGTestHarness curve={circle} init={{ trailLength: 200 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when headRadius changes", () => {
    const { rerender } = render(<SVGTestHarness curve={circle} init={{ headRadius: 4 }} />);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    rerender(<SVGTestHarness curve={circle} init={{ headRadius: 10 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when autoStart changes", () => {
    const { rerender } = render(<SVGTestHarness curve={circle} init={{ autoStart: true }} />);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    rerender(<SVGTestHarness curve={circle} init={{ autoStart: false }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("destroys and recreates when initialT changes", () => {
    const { rerender } = render(<SVGTestHarness curve={circle} init={{ initialT: 0 }} />);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);

    rerender(<SVGTestHarness curve={circle} init={{ initialT: 0.5 }} />);

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(2);
  });

  it("does not call morphTo on StrictMode remount with the same curve", () => {
    render(
      <React.StrictMode>
        <SVGTestHarness curve={circle} />
      </React.StrictMode>,
    );

    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });
});

describe("<SarmalSVG>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an SVG element", () => {
    render(<SarmalSVG curve={circle} />);

    expect(document.querySelector("svg")).not.toBeNull();
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("creates a sarmal SVG instance on mount", () => {
    render(<SarmalSVG curve={circle} />);

    expect(mockCreateSarmalSVG).toHaveBeenCalledTimes(1);
  });

  it("calls onReady with the instance after mount", () => {
    const onReady = vi.fn();

    render(<SarmalSVG curve={circle} onReady={onReady} />);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(mockInstance);
  });

  it("morphs when curve changes", () => {
    const { rerender } = render(<SarmalSVG curve={circle} />);

    rerender(<SarmalSVG curve={square} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, undefined);
  });

  it("forwards morphDuration on curve change", () => {
    const { rerender } = render(<SarmalSVG curve={circle} morphDuration={500} />);

    rerender(<SarmalSVG curve={square} morphDuration={500} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 500,
    });
  });

  it("calls setRenderOptions when trailColor changes", () => {
    const { rerender } = render(<SarmalSVG curve={circle} trailColor="#ff0000" />);

    rerender(<SarmalSVG curve={circle} trailColor="#00ff00" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: "#00ff00",
    });
  });

  it("calls setRenderOptions when skeletonColor changes", () => {
    const { rerender } = render(<SarmalSVG curve={circle} skeletonColor="#ffffff" />);

    rerender(<SarmalSVG curve={circle} skeletonColor="transparent" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      skeletonColor: "transparent",
    });
  });

  it("calls setRenderOptions when headColor changes", () => {
    const { rerender } = render(<SarmalSVG curve={circle} headColor="#ffffff" />);

    rerender(<SarmalSVG curve={circle} headColor="#ff0000" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      headColor: "#ff0000",
    });
  });

  it("calls setRenderOptions when trailStyle changes", () => {
    const { rerender } = render(<SarmalSVG curve={circle} trailStyle="default" />);

    rerender(<SarmalSVG curve={circle} trailStyle="gradient-animated" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailStyle: "gradient-animated",
    });
  });

  it("destroys instance on unmount", () => {
    const { unmount } = render(<SarmalSVG curve={circle} />);

    unmount();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("passes trailLength to createSarmalSVG", () => {
    render(<SarmalSVG curve={circle} trailLength={60} />);

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(expect.anything(), circle, {
      trailLength: 60,
    });
  });

  it("passes headRadius to createSarmalSVG", () => {
    render(<SarmalSVG curve={circle} headRadius={10} />);

    expect(mockCreateSarmalSVG).toHaveBeenCalledWith(expect.anything(), circle, {
      headRadius: 10,
    });
  });
});
