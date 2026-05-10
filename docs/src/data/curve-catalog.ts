import { curves, type CurveName } from "@sarmal/core";

export const ICONIC_CURVES: CurveName[] = ["artemis2"];

const iconicSet = new Set<string>(ICONIC_CURVES);
export const STANDARD_CURVES = (Object.keys(curves) as CurveName[]).filter(
  (name) => !iconicSet.has(name),
);
