import type { CurveDef } from "@sarmal/core";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { useSarmal, Sarmal } from "./index";

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
  };
});

import { createSarmal } from "@sarmal/core";
const mockCreateSarmal = vi.mocked(createSarmal);

describe("useSarmal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function TestHarness({
    curve,
    options,
  }: {
    curve: CurveDef;
    options?: { morphDuration?: number };
  }) {
    const { canvasRef, instance } = useSarmal(curve, { trailColor: "#ff0000" }, options);
    return (
      <canvas
        ref={canvasRef}
        data-testid="canvas"
        data-instance={instance.current ? "true" : "false"}
      />
    );
  }

  it("creates a sarmal instance on mount", () => {
    render(<TestHarness curve={circle} />);
    const canvas = screen.getByTestId("canvas");

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
    expect(mockCreateSarmal).toHaveBeenCalledWith(canvas, circle, {
      trailColor: "#ff0000",
    });
  });

  it("calls destroy on unmount", () => {
    const { unmount } = render(<TestHarness curve={circle} />);

    unmount();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it("does not recreate when options change (init-only)", () => {
    const { rerender } = render(<TestHarness curve={circle} />);
    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);

    rerender(<TestHarness curve={circle} />);

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
  });

  it("morphs when curve reference changes", () => {
    const { rerender } = render(<TestHarness curve={circle} />);

    rerender(<TestHarness curve={square} />);

    expect(mockInstance.morphTo).toHaveBeenCalledTimes(1);
    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, undefined);
  });

  it("forwards morphDuration to morphTo when curve changes", () => {
    const { rerender } = render(<TestHarness curve={circle} options={{ morphDuration: 500 }} />);

    rerender(<TestHarness curve={square} options={{ morphDuration: 500 }} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 500,
    });
  });

  it("does not call morphTo on first render", () => {
    render(<TestHarness curve={circle} />);

    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });

  it("swallows morphTo rejection (destroy called mid-morph)", async () => {
    mockInstance.morphTo.mockRejectedValueOnce(new Error("Instance destroyed during morph"));
    const { rerender } = render(<TestHarness curve={circle} />);

    // should not throw or produce an unhandled rejection
    rerender(<TestHarness curve={square} />);
  });

  it("does not call morphTo on StrictMode remount with the same curve", () => {
    // React 18 StrictMode double-invokes effects in development. With the old
    // isFirstCurveEffectRun approach the ref stayed false on remount and triggered
    // a spurious morphTo. committedCurveRef compares by identity so it stays silent.
    render(
      <React.StrictMode>
        <TestHarness curve={circle} />
      </React.StrictMode>,
    );

    expect(mockInstance.morphTo).not.toHaveBeenCalled();
  });
});

describe("<Sarmal>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a canvas element", () => {
    render(<Sarmal curve={circle} />);

    expect(document.querySelector("canvas")).not.toBeNull();
  });

  it("creates a sarmal instance on mount", () => {
    render(<Sarmal curve={circle} />);

    expect(mockCreateSarmal).toHaveBeenCalledTimes(1);
  });

  it("calls onReady with the instance after mount", () => {
    const onReady = vi.fn();

    render(<Sarmal curve={circle} onReady={onReady} />);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(mockInstance);
  });

  it("morphs when curve changes", () => {
    const { rerender } = render(<Sarmal curve={circle} />);

    rerender(<Sarmal curve={square} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, undefined);
  });

  it("forwards morphDuration on curve change", () => {
    const { rerender } = render(<Sarmal curve={circle} morphDuration={500} />);

    rerender(<Sarmal curve={square} morphDuration={500} />);

    expect(mockInstance.morphTo).toHaveBeenCalledWith(square, {
      duration: 500,
    });
  });

  it("calls setRenderOptions when trailColor changes", () => {
    const { rerender } = render(<Sarmal curve={circle} trailColor="#ff0000" />);

    rerender(<Sarmal curve={circle} trailColor="#00ff00" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: "#00ff00",
    });
  });

  it("does not call setRenderOptions when trailColor array is shallow-equal", () => {
    const colors = ["#ff0000", "#00ff00"];
    const { rerender } = render(<Sarmal curve={circle} trailColor={colors} />);

    rerender(<Sarmal curve={circle} trailColor={colors} />);

    expect(mockInstance.setRenderOptions).not.toHaveBeenCalled();
  });

  it("calls setRenderOptions when trailColor array changes", () => {
    const { rerender } = render(<Sarmal curve={circle} trailColor={["#ff0000", "#00ff00"]} />);

    rerender(<Sarmal curve={circle} trailColor={["#0000ff", "#ff00ff"]} />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailColor: ["#0000ff", "#ff00ff"],
    });
  });

  it("calls setRenderOptions when skeletonColor changes", () => {
    const { rerender } = render(<Sarmal curve={circle} skeletonColor="#ffffff" />);

    rerender(<Sarmal curve={circle} skeletonColor="transparent" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      skeletonColor: "transparent",
    });
  });

  it("calls setRenderOptions when headColor changes", () => {
    const { rerender } = render(<Sarmal curve={circle} headColor="#ffffff" />);

    rerender(<Sarmal curve={circle} headColor="#ff0000" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      headColor: "#ff0000",
    });
  });

  it("calls setRenderOptions when trailStyle changes", () => {
    const { rerender } = render(<Sarmal curve={circle} trailStyle="default" />);

    rerender(<Sarmal curve={circle} trailStyle="gradient-animated" />);

    expect(mockInstance.setRenderOptions).toHaveBeenCalledWith({
      trailStyle: "gradient-animated",
    });
  });

  it("destroys instance on unmount", () => {
    const { unmount } = render(<Sarmal curve={circle} />);

    unmount();

    expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  });
});
