import { CURVE_DOCS } from "./curves";

export interface CurveMetadata {
  id: string;
  name: string;
  family: string;
  equation: string;
  description: string;
}

export const curveMetadata: Record<string, CurveMetadata> = Object.fromEntries(
  Object.entries(CURVE_DOCS).map(([id, meta]) => [
    id,
    {
      id,
      name: meta.name,
      family: meta.family,
      equation: meta.equationSimple,
      description: meta.description,
    },
  ]),
);

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
