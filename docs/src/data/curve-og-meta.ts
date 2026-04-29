import { CURVE_DOCS } from "./curves";

export interface CurveOGMeta {
  id: string;
  name: string;
  color: string;
}

export const CURVE_OG_META: Record<string, CurveOGMeta> = Object.fromEntries(
  Object.entries(CURVE_DOCS).map(([curveKey, meta]) => {
    return [curveKey, { id: curveKey, name: meta.name, color: meta.color }];
  }),
);
