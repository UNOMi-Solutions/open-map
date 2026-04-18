/**
 * Age groups for census population (subcategory under race).
 * Only groups that have data files are shown. Add entries when you add new Age* files.
 */
export const CENSUS_AGE_GROUPS: { id: string; label: string }[] = [
  { id: "1_5", label: "1–5" },
  { id: "6_10", label: "6–10" },
  { id: "11_14", label: "11–14" },
  { id: "15_19", label: "15–19" },
  { id: "20_35", label: "20–35" },
  { id: "36_45", label: "36–45" },
  { id: "46_55", label: "46–55" },
  { id: "56_65", label: "56–65" },
  { id: "66_75", label: "66–75" },
  { id: "76_85", label: "76–85" },
  { id: "96_105", label: "96–105" },
  { id: "105_plus", label: "105+" },
];

/** Census race id (UI) -> prefix for race+age data files under /data/ */
export const CENSUS_RACE_TO_DATA_PREFIX: Record<string, string> = {
  black: "black",
  white: "white",
  "latin-hispanic": "hispanic",
  asian: "asian",
  "east-asian": "eastAsian",
  arab: "arab",
};
