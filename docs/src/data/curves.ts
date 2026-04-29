import type { CurveName } from "@sarmal/core";

export interface CurveDocsMeta {
  name: string;
  color: string;
  family: string;
  equation: string; // LaTeX for curve detail pages
  equationSimple: string; // ASCII for modal dialogs
  description: string; // Short description for modals / DemoSection
  descriptionLong: string; // Longer description for curve detail pages
  features: string[];
  importPath: string;
  periodStr: string; // "2π" or "4π"
  speed: number;
  skeleton: string; // "static", "live", "custom (stabilized)"
}

export const CURVE_DOCS: Record<CurveName, CurveDocsMeta> = {
  artemis2: {
    name: "Artemis II",
    color: "#60a5fa",
    family: "Free-return trajectory",
    equation:
      "x = \\frac{\\cos(t)\\,(1 + 0.35\\cos(t))}{1 + \\sin^2(t)} - 0.175 \\\\ y = \\frac{\\sin(t)\\cos(t)\\,(1 + 0.15\\cos(t))}{1 + \\sin^2(t)}",
    equationSimple:
      "x = cos(t)·(1+0.35cos(t))/(1+sin²(t)) - 0.175, y = sin(t)cos(t)·(1+0.15cos(t))/(1+sin²(t))",
    description:
      "Modified lemniscate with two unequal lobes. The iconic curve of the collection, tracing a path inspired by the Artemis II lunar free-return trajectory.",
    descriptionLong:
      "Modified lemniscate with two unequal lobes. The iconic curve of the collection, tracing a path inspired by the Artemis II lunar free-return trajectory.",
    features: [
      "Two unequal lobes creating organic asymmetry",
      "Based on NASA's Artemis II mission trajectory",
      "Hero curve of the Sarmal collection",
    ],
    importPath: "@sarmal/core/curves/artemis2",
    periodStr: "2π",
    speed: 0.7,
    skeleton: "static",
  },
  epitrochoid7: {
    name: "Epitrochoid",
    color: "#a78bfa",
    family: "Roulette",
    equation:
      "x = 7\\cos(t) - d\\cos(7t) \\\\ y = 7\\sin(t) - d\\sin(7t) \\\\ \\text{where } d = 1.0 + 0.55\\sin(0.5t)",
    equationSimple: "x = 7cos(t) - d·cos(7t), y = 7sin(t) - d·sin(7t)",
    description:
      "A roulette tracing 7 lobes with an animated distance parameter that creates organic, undulating motion.",
    descriptionLong:
      "A roulette tracing 7 lobes with an animated distance parameter that creates organic, undulating motion.",
    features: [
      "7 lobes with flower-like symmetry",
      "Dynamic distance parameter creates organic motion",
      "Custom skeleton uses fixed d=1.275 for stability",
    ],
    importPath: "@sarmal/core/curves/epitrochoid7",
    periodStr: "2π",
    speed: 1.4,
    skeleton: "custom (stabilized)",
  },
  astroid: {
    name: "Astroid",
    color: "#38bdf8",
    family: "Hypocycloid",
    equation: "x = \\cos^3(t) \\\\ y = \\sin^3(t)",
    equationSimple: "x = cos³(t), y = sin³(t)",
    description:
      "A hypocycloid with 4 sharp cusps, forming a star-like shape within a square boundary.",
    descriptionLong:
      "A hypocycloid with 4 sharp cusps, forming a star-like shape within a square boundary.",
    features: [
      "4 sharp cusps at cardinal points",
      "Star-like shape inscribed in a square",
      "Classic hypocycloid with n=4",
    ],
    importPath: "@sarmal/core/curves/astroid",
    periodStr: "2π",
    speed: 1.1,
    skeleton: "static",
  },
  deltoid: {
    name: "Deltoid",
    color: "#fb923c",
    family: "Hypocycloid",
    equation: "x = 2\\cos(t) + \\cos(2t) \\\\ y = 2\\sin(t) - \\sin(2t)",
    equationSimple: "x = 2cos(t) + cos(2t), y = 2sin(t) - sin(2t)",
    description: "A 3-cusped hypocycloid tracing a triangular-like curve with curved sides.",
    descriptionLong: "A 3-cusped hypocycloid tracing a triangular-like curve with curved sides.",
    features: [
      "3 cusps creating triangular symmetry",
      "Curved sides between cusps",
      "Classic hypocycloid with n=3",
    ],
    importPath: "@sarmal/core/curves/deltoid",
    periodStr: "2π",
    speed: 0.9,
    skeleton: "static",
  },
  rose3: {
    name: "Rose (n=3)",
    color: "#e879f9",
    family: "Rose",
    equation: "r = \\cos(3t) \\\\ x = r\\cos(t) \\\\ y = r\\sin(t)",
    equationSimple: "r = cos(3t)",
    description:
      "A three-petaled rose curve traced by a point moving along a line rotating around the origin.",
    descriptionLong:
      "A 3-petaled rose curve with trifold symmetry, created using a polar equation.",
    features: [
      "3 petals with radial symmetry",
      "Polar equation: r = cos(3t)",
      "Classic rhodonea curve",
    ],
    importPath: "@sarmal/core/curves/rose3",
    periodStr: "2π",
    speed: 1.15,
    skeleton: "static",
  },
  rose5: {
    name: "Rose (n=5)",
    color: "#f472b6",
    family: "Rose",
    equation: "r = \\cos(5t) \\\\ x = r\\cos(t) \\\\ y = r\\sin(t)",
    equationSimple: "r = cos(5t)",
    description:
      "A five-petaled rose curve, exploring how mathematical parameters create natural beauty.",
    descriptionLong:
      "A 5-petaled rose curve with fivefold symmetry, created using a polar equation.",
    features: [
      "5 petals with radial symmetry",
      "Polar equation: r = cos(5t)",
      "Classic rhodonea curve",
    ],
    importPath: "@sarmal/core/curves/rose5",
    periodStr: "2π",
    speed: 1.0,
    skeleton: "static",
  },
  rose52: {
    name: "Rose (n=5/2)",
    color: "#e879f9",
    family: "Rose",
    equation: "r = \\cos\\!\\left(\\tfrac{5}{2}t\\right) \\\\ x = r\\cos(t) \\\\ y = r\\sin(t)",
    equationSimple: "r = cos(5t/2)",
    description:
      "A 5-petaled rose curve with a fractional n=5/2, requiring two full revolutions to complete.",
    descriptionLong:
      "A 5-petaled rose curve with a fractional n=5/2, requiring two full revolutions to complete. The head passes through the center between petals, creating elegant crossing trails.",
    features: [
      "5 petals traced over two full revolutions (period 4π)",
      "Head crosses through the center between petals",
      "Fractional n=5/2 creates denser, more intricate trail crossings than integer-n roses",
    ],
    importPath: "@sarmal/core/curves/rose52",
    periodStr: "4π",
    speed: 0.8,
    skeleton: "static",
  },
  lissajous32: {
    name: "Lissajous 3:2",
    color: "#fb923c",
    family: "Lissajous",
    equation:
      "x = \\sin(3t + \\varphi) \\\\ y = \\sin(2t) \\\\ \\text{where } \\varphi = t_{\\text{time}} \\cdot 0.45",
    equationSimple: "x = sin(3t + φ), y = sin(2t)",
    description:
      "A classic Lissajous figure where the 3:2 frequency ratio creates elegant looping patterns.",
    descriptionLong:
      "A figure-eight-like curve with a slowly drifting phase that causes the skeleton to morph continuously.",
    features: [
      "3:2 frequency ratio creates figure-eight pattern",
      "Phase drift causes continuous skeleton morphing",
      "Live skeleton that evolves over time",
    ],
    importPath: "@sarmal/core/curves/lissajous32",
    periodStr: "2π",
    speed: 2.0,
    skeleton: "live",
  },
  lissajous43: {
    name: "Lissajous 4:3",
    color: "#2dd4bf",
    family: "Lissajous",
    equation:
      "x = \\sin(4t + \\varphi) \\\\ y = \\sin(3t) \\\\ \\text{where } \\varphi = t_{\\text{time}} \\cdot 0.38",
    equationSimple: "x = sin(4t + φ), y = sin(3t)",
    description:
      "The harmonic dance of two perpendicular oscillations creates this mesmerizing curve family.",
    descriptionLong:
      "A more complex Lissajous pattern with 4:3 frequency ratio and drifting phase, creating an interweaving pattern.",
    features: [
      "4:3 frequency ratio creates complex interweaving",
      "Phase drift causes continuous skeleton morphing",
      "Live skeleton that evolves over time",
    ],
    importPath: "@sarmal/core/curves/lissajous43",
    periodStr: "2π",
    speed: 1.8,
    skeleton: "live",
  },
  epicycloid3: {
    name: "Epicycloid (n=3)",
    color: "#60a5fa",
    family: "Roulette",
    equation: "x = 4\\cos(t) - \\cos(4t) \\\\ y = 4\\sin(t) - \\sin(4t)",
    equationSimple: "x = 4cos(t) - cos(4t), y = 4sin(t) - sin(4t)",
    description:
      "A 3-pointed star shape created by a point on a circle rolling around the outside of another circle.",
    descriptionLong:
      "A 3-pointed star shape created by a point on a circle rolling around the outside of another circle.",
    features: [
      "3-pointed star shape",
      "Created by exterior rolling circle",
      "Classic epicycloid with n=3",
    ],
    importPath: "@sarmal/core/curves/epicycloid3",
    periodStr: "2π",
    speed: 0.75,
    skeleton: "static",
  },
  lame: {
    name: "Lamé Curve",
    color: "#a78bfa",
    family: "Superellipse",
    equation:
      "x = \\operatorname{sgn}(\\cos t)\\,|\\cos t|^{p} \\\\ y = \\operatorname{sgn}(\\sin t)\\,|\\sin t|^{p} \\\\ \\text{where } p = 1.75 + 1.25\\sin(t_{\\text{time}} \\cdot 0.48)",
    equationSimple: "x = sgn(cos t)·|cos t|^p, y = sgn(sin t)·|sin t|^p",
    description:
      "A family of superellipses discovered by Gabriel Lamé in 1818, smoothly transitioning between squares and circles.",
    descriptionLong:
      "A superellipse that morphs continuously between diamond, circle, and squircle shapes as the exponent oscillates.",
    features: [
      "Morphs between diamond, circle, and squircle",
      "Exponent p oscillates between 0.5 and 3.0",
      "Live skeleton shifts continuously",
    ],
    importPath: "@sarmal/core/curves/lame",
    periodStr: "2π",
    speed: 1.0,
    skeleton: "live",
  },
  star: {
    name: "Star",
    color: "#fbbf24",
    family: "Fourier polar",
    equation:
      "r = \\left|\\cos\\!\\left(\\tfrac{5}{2}t\\right)\\right| + 0.35\\left|\\cos\\!\\left(\\tfrac{15}{2}t\\right)\\right| + 0.15\\left|\\cos\\!\\left(\\tfrac{25}{2}t\\right)\\right| \\\\ x = r\\cos(t) \\\\ y = r\\sin(t)",
    equationSimple: "r = |cos(5t/2)| + 0.35|cos(15t/2)| + 0.15|cos(25t/2)|",
    description: "A 5-pointed star shape built from Fourier harmonics in polar coordinates.",
    descriptionLong: "A 5-pointed star shape built from Fourier harmonics in polar coordinates.",
    features: [
      "5 sharp tips from the fundamental frequency",
      "Two higher harmonics sharpen the tips and add subtle texture",
      "Fully closed in a single revolution",
    ],
    importPath: "@sarmal/core/curves/star",
    periodStr: "2π",
    speed: 1.0,
    skeleton: "static",
  },
  star4: {
    name: "Star (4-arm)",
    color: "#f472b6",
    family: "Fourier polar",
    equation:
      "r = \\left|\\cos(2t)\\right| + 0.35\\left|\\cos(6t)\\right| + 0.15\\left|\\cos(10t)\\right| \\\\ x = r\\cos(t) \\\\ y = r\\sin(t)",
    equationSimple: "r = |cos(2t)| + 0.35|cos(6t)| + 0.15|cos(10t)|",
    description: "A 4-pointed star shape built from Fourier harmonics in polar coordinates.",
    descriptionLong: "A 4-pointed star shape built from Fourier harmonics in polar coordinates.",
    features: [
      "4 sharp tips from base frequency 2t",
      "Same harmonic construction as Star but with 4-fold symmetry",
      "Fully closed in a single revolution",
    ],
    importPath: "@sarmal/core/curves/star4",
    periodStr: "2π",
    speed: 1.0,
    skeleton: "static",
  },
  star7: {
    name: "Star (7-arm)",
    color: "#34d399",
    family: "Fourier polar",
    equation:
      "r = \\left|\\cos\\!\\left(\\tfrac{7}{2}t\\right)\\right| + 0.35\\left|\\cos\\!\\left(\\tfrac{21}{2}t\\right)\\right| + 0.15\\left|\\cos\\!\\left(\\tfrac{35}{2}t\\right)\\right| \\\\ x = r\\cos(t) \\\\ y = r\\sin(t)",
    equationSimple: "r = |cos(7t/2)| + 0.35|cos(21t/2)| + 0.15|cos(35t/2)|",
    description: "A 7-pointed star shape built from Fourier harmonics in polar coordinates.",
    descriptionLong: "A 7-pointed star shape built from Fourier harmonics in polar coordinates.",
    features: [
      "7 sharp tips from base frequency 7t/2",
      "Same harmonic construction as Star but with 7-fold symmetry",
      "Fully closed in a single revolution",
    ],
    importPath: "@sarmal/core/curves/star7",
    periodStr: "2π",
    speed: 1.0,
    skeleton: "static",
  },
} as const;

export const CURVE_URL_IDS = Object.keys(CURVE_DOCS) as CurveName[];

export function lookupByUrl(urlId: string): CurveDocsMeta | undefined {
  return CURVE_DOCS[urlId as CurveName];
}
