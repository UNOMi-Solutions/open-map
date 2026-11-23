# Drug overdose deaths

The Health option **Drug Overdose Deaths** uses CDC/NCHS provisional county-level overdose mortality data (`gb4e-yj24`). It shows deaths by county of residence in rolling twelve-month windows, not individual incidents, addiction prevalence, or deaths occurring within the selected calendar month. CDC publishes quarterly updates with a reporting lag and may revise counts.

`GET /api/v1/health/drugOverdoseDeaths?period=latest` discovers the latest available CDC reporting period. An explicit `YYYY-MM` chooses a historical period. The response includes available periods, CDC data-as-of date, county counts, suppression status, population estimates and their years, crude rates per 100,000 residents, investigation percentages, and completeness notes. The health router is already mounted behind API-key protection in `backend/index.js`. No new credentials or dependencies are required. The optional existing `HEALTHDATA_API_KEY` can be used as a Socrata app token.

Rates are calculated as reported deaths divided by the county population times 100,000. The denominator is the Census Vintage 2025 annual county population estimate for the period's ending year, or the latest published year at or before that year. Thus a March 2026 period uses July 2025 population. Rates are approximate crude rates, not age-adjusted CDC-published rates. The Census public CSV requires no API key. Counties without a matching denominator retain reported counts but have no calculated rate. No county crosswalk or population substitution is guessed.

Counts of 1–9 remain suppressed and are never converted to zero or used for rates. Missing counts are separate from true zero. Identical CDC aliases sharing a FIPS code (including retired Virginia cities) are deduplicated without adding counts; conflicts are marked unavailable. Full, consistently dated CDC pages are required before caching a snapshot. CDC data cache for 24 hours, population data for seven days, and frontend Health data for 24 hours. Failed downloads are retryable and are not cached as success.

The map reuses the existing county boundary file and Health white-to-red palette, with fixed rate bins and a separate gray for suppression. Unmatched boundaries remain unavailable rather than receiving a guessed value. Popups show the reason for unavailable rates, source links, reporting window, denominator year, and provisional-data notes. The period control is saved/restored with profiles and reset to latest by Reset All. The layer shares Health's exclusivity with other health, Census, and SPLC shading, and pauses under political district shading. Existing historical boundary limitations are disclosed in the legend.

Sources:
- https://www.cdc.gov/nchs/nvss/vsrr/prov-county-drug-overdose.htm
- https://data.cdc.gov/resource/gb4e-yj24.json
- https://www.census.gov/data/datasets/time-series/demo/popest/2020s-counties-total.html
- https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv

Run `npm test` in `backend`, `node --import tsx --test client/src/lib/*.test.ts` in `frontend`, and `npm run build` in `frontend`.
