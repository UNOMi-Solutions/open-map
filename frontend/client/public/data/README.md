# Census data files

## Race-only (existing)

- `pct_White` – JSON: `{ [GEOID]: { pctWhite: number } }`
- `pct_Black` – JSON: `{ [GEOID]: { pctBlack: number } }`
- `pct_Hispanic` – JSON: `{ [GEOID]: { pctHispanic: number } }`

GEOID = county FIPS code (e.g. `10001`, `56045`).

## Race + age (population subcategory)

One file per **race** and **age group**. Naming:

- **File name:** `{race}_age_{ageId}` (no extension; served as JSON).
- **Race prefix:** `black`, `white`, or `hispanic` (matches Census tab: Black, White, Latin/Hispanic).
- **Age id:** matches `CENSUS_AGE_GROUPS` in `client/src/lib/census-age-groups.ts`, e.g. `0_2`, `3_5`, `6_8`, `9_11`, `12_14`, `15_17`, `18_20`, `21_29`, `30_39`, `40_49`, `50_59`, `60_69`, `70_79`, `80_89`, `90_100`.

**Examples:** `black_age_0_2`, `white_age_3_5`, `hispanic_age_21_29`.

**JSON shape (either):**

- `{ [GEOID]: number }` – value per county (e.g. percent or count).
- `{ [GEOID]: { value: number } }` – same, under a `value` property.

Values are used for the choropleth color scale. Add one file per (race, age) combination you want to support.
