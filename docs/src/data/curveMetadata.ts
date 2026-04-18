export interface CurveMetadata {
  id: string;
  name: string;
  family: string;
  equation: string;
  description: string;
}

export const curveMetadata: Record<string, CurveMetadata> = {
  rose3: {
    id: "rose3",
    name: "Rose (n=3)",
    family: "Rose",
    equation: "r = cos(3θ)",
    description:
      "A three-petaled rose curve traced by a point moving along a line rotating around the origin.",
  },
  deltoid: {
    id: "deltoid",
    name: "Deltoid",
    family: "Roulette",
    equation: "x = 2cos(t) + cos(2t), y = 2sin(t) - sin(2t)",
    description:
      "A three-cusped hypocycloid formed by a point on the circumference of a circle rolling inside a larger circle.",
  },
  astroid: {
    id: "astroid",
    name: "Astroid",
    family: "Roulette",
    equation: "x = cos³(t), y = sin³(t)",
    description:
      "A four-cusped hypocycloid where the ratio of the radii of the rolling and fixed circles is 4:1.",
  },
  epitrochoid7: {
    id: "epitrochoid7",
    name: "Epitrochoid",
    family: "Roulette",
    equation: "x = 7cos(t) - d·cos(7t), y = 7sin(t) - d·sin(7t)",
    description:
      "Created by tracing a point attached to a circle rolling around the outside of another circle.",
  },
  rose5: {
    id: "rose5",
    name: "Rose (n=5)",
    family: "Rose",
    equation: "r = cos(5θ)",
    description:
      "A five-petaled rose curve, exploring how mathematical parameters create natural beauty.",
  },
  lissajous43: {
    id: "lissajous43",
    name: "Lissajous 4:3",
    family: "Lissajous",
    equation: "x = sin(4t + φ), y = sin(3t)",
    description:
      "The harmonic dance of two perpendicular oscillations creates this mesmerizing curve family.",
  },
  lissajous32: {
    id: "lissajous32",
    name: "Lissajous 3:2",
    family: "Lissajous",
    equation: "x = sin(3t + φ), y = sin(2t)",
    description:
      "A classic Lissajous figure where the 3:2 frequency ratio creates elegant looping patterns.",
  },
  lame: {
    id: "lame",
    name: "Lamé Curve",
    family: "Lamé",
    equation: "x = sign(cos t)·|cos t|^p, y = sign(sin t)·|sin t|^p",
    description:
      "A family of superellipses discovered by Gabriel Lamé in 1818, smoothly transitioning between squares and circles.",
  },
};

export const morphPairsMetadata = [
  {
    from: "astroid",
    to: "deltoid",
    description: "Morphs between a four-cusped and three-cusped hypocycloid.",
  },
  {
    from: "rose3",
    to: "epitrochoid7",
    description: "Transitions from a three-petaled rose to a complex epitrochoid pattern.",
  },
  {
    from: "lissajous32",
    to: "rose5",
    description: "Merges harmonic oscillations into a five-petaled floral form.",
  },
  {
    from: "lame",
    to: "astroid",
    description: "The smooth path between distinct curve families from superellipse to hypocycloid",
  },
];
