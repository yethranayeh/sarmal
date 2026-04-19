// @vitest-environment jsdom
import type { CurveDef } from "./types";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { createEngine } from "./engine";
import { createSVGRenderer, createSarmalSVG } from "./renderer-svg";
import { palettes } from "./renderer-shared";

const testCircle: CurveDef = {
  name: "test-circle",
  fn: (t) => ({ x: Math.cos(t), y: Math.sin(t) }),
  period: Math.PI * 2,
  speed: 1,
};

function makeContainer(): HTMLElement {
  const div = document.createElement("div");
  div.style.width = "200px";
  div.style.height = "200px";
  // jsdom does not lay out, so we mock the rect
  div.getBoundingClientRect = () => ({
    width: 200,
    height: 200,
    top: 0,
    left: 0,
    bottom: 200,
    right: 200,
    x: 0,
    y: 0,
    toJSON: () => {},
  });
  document.body.appendChild(div);
  return div;
}

function getSvg(container: Element): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg in container");
  return svg;
}

function getTrailPaths(container: Element): SVGPathElement[] {
  const svg = getSvg(container);
  // Trail paths are every <path> that is NOT the skeleton and NOT the morph skeletons.
  // The simplest selector: paths without a `data-sarmal-role` attribute, and excluding
  // the (hidden) morph skeleton paths. The renderer tags only the primary skeleton
  // with `data-sarmal-role="skeleton"`, so we pick paths with no role attr.
  return Array.from(svg.querySelectorAll("path")).filter(
    (p) => p.getAttribute("data-sarmal-role") === null && p.getAttribute("stroke") === null,
  );
}

function getHeadCircle(container: Element): SVGCircleElement {
  const circle = container.querySelector<SVGCircleElement>('circle[data-sarmal-role="head"]');
  if (!circle) throw new Error("no head circle");
  return circle;
}

function getSkeletonPath(container: Element): SVGPathElement {
  const path = container.querySelector<SVGPathElement>('path[data-sarmal-role="skeleton"]');
  if (!path) throw new Error("no skeleton path");
  return path;
}

// rAF mock — all SVG tests pause immediately, so one scheduled frame is enough.
beforeEach(() => {
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
  // `matchMedia` is used by the SVG renderer to detect prefers-reduced-motion.
  // jsdom does not implement it.
  if (!window.matchMedia) {
    // @ts-expect-error minimal stub
    window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("createSVGRenderer() exposes setRenderOptions", () => {
  it("returns an instance with setRenderOptions", () => {
    const container = makeContainer();
    const engine = createEngine(testCircle);
    const instance = createSVGRenderer({ container, engine, autoStart: false });
    expect(typeof instance.setRenderOptions).toBe("function");
    instance.destroy();
  });
});

describe("setRenderOptions — SVG attribute re-apply", () => {
  it("trailColor change in default style paints every pre-allocated trail <path>", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailColor: "#ff0000",
      trailStyle: "default",
    });

    // Before: every trail path's fill was set to #ff0000 at init.
    const trailPaths = getTrailPaths(container);
    expect(trailPaths.length).toBeGreaterThan(0);
    for (const p of trailPaths) expect(p.getAttribute("fill")).toBe("#ff0000");

    instance.setRenderOptions({ trailColor: "#00ff00" });

    // After: every trail path's fill was re-painted to the new color.
    for (const p of trailPaths) expect(p.getAttribute("fill")).toBe("#00ff00");

    instance.destroy();
  });

  it("trailColor change in gradient style does NOT re-seed path fills (per-frame writes own them)", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailStyle: "gradient-animated",
      trailColor: palettes.bard,
    });

    const trailPaths = getTrailPaths(container);
    const before = trailPaths.map((p) => p.getAttribute("fill"));

    instance.setRenderOptions({ trailColor: palettes.sunset });

    // Per-segment fills are rewritten by updateTrail every frame in gradient
    // mode, so setRenderOptions must NOT touch them — otherwise we'd stomp on
    // the freshly-computed gradient colors.
    const after = trailPaths.map((p) => p.getAttribute("fill"));
    expect(after).toEqual(before);

    instance.destroy();
  });

  it("trailStyle gradient → default re-seeds every trail <path> to the current solid color", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailStyle: "gradient-animated",
      trailColor: palettes.bard,
      // Extra: explicitly set a solid color so we can check the re-seed.
      // (In gradient mode it is unused; switching to default activates it.)
    });

    instance.setRenderOptions({ trailColor: "#ff0000" });
    // At this point, per-segment fills were NOT touched (gradient mode writes
    // them every frame). Still, the cached solid is now "#ff0000".

    instance.setRenderOptions({ trailStyle: "default" });

    // Now every trail path should be re-seeded to the solid.
    const trailPaths = getTrailPaths(container);
    for (const p of trailPaths) expect(p.getAttribute("fill")).toBe("#ff0000");

    instance.destroy();
  });

  it("skeletonColor change updates the stroke attribute on the skeleton path", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      skeletonColor: "#ffffff",
    });

    const skeletonPath = getSkeletonPath(container);
    expect(skeletonPath.getAttribute("stroke")).toBe("#ffffff");

    instance.setRenderOptions({ skeletonColor: "#123456" });
    expect(skeletonPath.getAttribute("stroke")).toBe("#123456");

    instance.destroy();
  });

  it("skeletonColor: 'transparent' hides the skeleton and a subsequent hex color shows it again", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      skeletonColor: "#ffffff",
    });

    const skeletonPath = getSkeletonPath(container);
    expect(skeletonPath.getAttribute("visibility")).toBeNull();

    instance.setRenderOptions({ skeletonColor: "transparent" });
    expect(skeletonPath.getAttribute("visibility")).toBe("hidden");

    instance.setRenderOptions({ skeletonColor: "#abcdef" });
    expect(skeletonPath.getAttribute("visibility")).toBeNull();
    expect(skeletonPath.getAttribute("stroke")).toBe("#abcdef");

    instance.destroy();
  });

  it("headColor change updates the head circle's fill attribute", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailColor: "#ff0000",
      trailStyle: "default",
    });

    const head = getHeadCircle(container);
    // Auto-follow: initial head color equals solid trail color.
    expect(head.getAttribute("fill")).toBe("#ff0000");

    instance.setRenderOptions({ headColor: "#aabbcc" });
    expect(head.getAttribute("fill")).toBe("#aabbcc");

    instance.destroy();
  });

  it("auto-follow head color updates on trailColor change", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailColor: "#ff0000",
      trailStyle: "default",
    });

    const head = getHeadCircle(container);
    expect(head.getAttribute("fill")).toBe("#ff0000");

    instance.setRenderOptions({ trailColor: "#00ff00" });
    expect(head.getAttribute("fill")).toBe("#00ff00");

    instance.destroy();
  });

  it("auto-follow head color is restored when headColor is set back to null", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailColor: "#ff0000",
      trailStyle: "default",
    });

    const head = getHeadCircle(container);

    instance.setRenderOptions({ headColor: "#aabbcc" });
    expect(head.getAttribute("fill")).toBe("#aabbcc");

    instance.setRenderOptions({ headColor: null });
    // Still red because trailColor hasn't changed, but now auto-follow is on.
    expect(head.getAttribute("fill")).toBe("#ff0000");

    instance.setRenderOptions({ trailColor: "#00ff00" });
    expect(head.getAttribute("fill")).toBe("#00ff00");

    instance.destroy();
  });

  it("fail-atomic: invalid payload throws without mutating any DOM attribute", () => {
    const container = makeContainer();
    const instance = createSarmalSVG(container, testCircle, {
      autoStart: false,
      trailColor: "#ff0000",
      trailStyle: "default",
    });

    const head = getHeadCircle(container);
    const trailPaths = getTrailPaths(container);
    const headBefore = head.getAttribute("fill");
    const trailBefore = trailPaths.map((p) => p.getAttribute("fill"));

    expect(() =>
      instance.setRenderOptions({
        trailColor: "#00ff00", // valid
        trailStyle: "bogus" as unknown as "default", // invalid → whole call throws
      }),
    ).toThrow();

    // Nothing should have changed.
    expect(head.getAttribute("fill")).toBe(headBefore);
    expect(trailPaths.map((p) => p.getAttribute("fill"))).toEqual(trailBefore);

    instance.destroy();
  });
});

describe("SVG renderer — palette array applied at construction", () => {
  it("renders gradient segments from the palette after a tick", () => {
    const container = makeContainer();
    const engine = createEngine(testCircle);
    const instance = createSVGRenderer({
      container,
      engine,
      autoStart: false,
      trailStyle: "gradient-animated",
      trailColor: palettes.bard,
    });

    // The engine needs a few ticks to build up ≥2 trail points, which is the
    // minimum for updateTrail to paint segment fills.
    for (let i = 0; i < 20; i++) {
      engine.tick(0.016);
    }
    instance.play(); // one frame runs, then…
    instance.pause();

    // The head circle should carry an `rgb(...)` fill derived from the last
    // palette stop, proving the palette was picked up at construction.
    const head = getHeadCircle(container);
    expect(head.getAttribute("fill")).toMatch(/^rgb\(\d+,\d+,\d+\)$/);

    instance.destroy();
  });
});
