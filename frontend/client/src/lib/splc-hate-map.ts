/**
 * SPLC Hate Map data (see client/public/data/splc/README.md).
 * Built from SPLC CSV via: npm run data:splc
 */
export const SPLC_HATE_MAP_LAYER_ID = "most-racist";

export const SPLC_LAYER_IDS = new Set<string>([SPLC_HATE_MAP_LAYER_ID]);

export const SPLC_HATE_MAP_LABEL =
  "SPLC hate & antigovernment groups (HQ in state)";

/** Short citation for legends / tooltips */
export const SPLC_HATE_MAP_SOURCE_CREDIT =
  "Southern Poverty Law Center — Hate Map (tabular download)";
