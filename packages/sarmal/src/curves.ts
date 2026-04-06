import type { CurveDef, Point } from "./types";

const TWO_PI = Math.PI * 2;

/**
 * Artemis II free-return lunar trajectory
 * @see https://www.nasa.gov/wp-content/uploads/2025/09/artemis-ii-map-508.pdf
 * a = x-axis asymmetry (widens one lobe),
 * b = y-axis asymmetry,
 * ox = horizontal offset to visually center the shape
 */
function artemis2(t: number, _time: number, _params: Record<string, number>): Point {
  const a = 0.35,
    b = 0.15,
    ox = 0.175;
  const s = Math.sin(t),
    c = Math.cos(t);
  const denom = 1 + s * s;
  return {
    x: (c * (1 + a * c)) / denom - ox,
    y: (s * c * (1 + b * c)) / denom,
  };
}

function epitrochoid7(t: number, _time: number, _params: Record<string, number>): Point {
  const d = 1.0 + 0.55 * Math.sin(t * 0.5);
  return {
    x: 7 * Math.cos(t) - d * Math.cos(7 * t),
    y: 7 * Math.sin(t) - d * Math.sin(7 * t),
  };
}

function epitrochoid7Skeleton(t: number): Point {
  // average of the oscillating range for a stable base shape
  const d = 1.275;
  return {
    x: 7 * Math.cos(t) - d * Math.cos(7 * t),
    y: 7 * Math.sin(t) - d * Math.sin(7 * t),
  };
}

function astroid(t: number, _time: number, _params: Record<string, number>): Point {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {
    x: c * c * c,
    y: s * s * s,
  };
}

function deltoid(t: number, _time: number, _params: Record<string, number>): Point {
  return {
    x: 2 * Math.cos(t) + Math.cos(2 * t),
    y: 2 * Math.sin(t) - Math.sin(2 * t),
  };
}

function rose5(t: number, _time: number, _params: Record<string, number>): Point {
  const r = Math.cos(5 * t);
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
  };
}

function rose3(t: number, _time: number, _params: Record<string, number>): Point {
  const r = Math.cos(3 * t);
  return {
    x: r * Math.cos(t),
    y: r * Math.sin(t),
  };
}

function lissajous32(t: number, time: number, _params: Record<string, number>): Point {
  const phi = time * 0.45;
  return {
    x: Math.sin(3 * t + phi),
    y: Math.sin(2 * t),
  };
}

function lissajous43(t: number, time: number, _params: Record<string, number>): Point {
  const phi = time * 0.38;
  return {
    x: Math.sin(4 * t + phi),
    y: Math.sin(3 * t),
  };
}

function epicycloid3(t: number, _time: number, _params: Record<string, number>): Point {
  return {
    x: 4 * Math.cos(t) - Math.cos(4 * t),
    y: 4 * Math.sin(t) - Math.sin(4 * t),
  };
}

function lame(t: number, time: number, _params: Record<string, number>): Point {
  const p = 1.75 + 1.25 * Math.sin(time * 0.48);
  const c = Math.cos(t),
    s = Math.sin(t);
  return {
    x: Math.sign(c) * Math.pow(Math.abs(c), p),
    y: Math.sign(s) * Math.pow(Math.abs(s), p),
  };
}
export const curves: Record<string, CurveDef> = {
  artemis2: {
    name: "Artemis II",
    fn: artemis2,
    period: TWO_PI,
    speed: 0.7,
  },
  epitrochoid7: {
    name: "Epitrochoid",
    fn: epitrochoid7,
    period: TWO_PI,
    speed: 1.4,
    skeletonFn: epitrochoid7Skeleton,
  },
  astroid: {
    name: "Astroid",
    fn: astroid,
    period: TWO_PI,
    speed: 1.1,
  },
  deltoid: {
    name: "Deltoid",
    fn: deltoid,
    period: TWO_PI,
    speed: 0.9,
  },
  rose5: {
    name: "Rose (n=5)",
    fn: rose5,
    period: TWO_PI,
    speed: 1.0,
  },
  rose3: {
    name: "Rose (n=3)",
    fn: rose3,
    period: TWO_PI,
    speed: 1.15,
  },
  lissajous32: {
    name: "Lissajous 3:2",
    fn: lissajous32,
    period: TWO_PI,
    speed: 2.0,
    skeleton: "live",
  },
  lissajous43: {
    name: "Lissajous 4:3",
    fn: lissajous43,
    period: TWO_PI,
    speed: 1.8,
    skeleton: "live",
  },
  epicycloid3: {
    name: "Epicycloid (n=3)",
    fn: epicycloid3,
    period: TWO_PI,
    speed: 0.75,
  },
  lame: {
    name: "Lamé Curve",
    fn: lame,
    period: TWO_PI,
    speed: 1.0,
    skeleton: "live",
  },
};
