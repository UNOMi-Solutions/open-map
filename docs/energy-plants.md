# Energy plants

The Environment layer maps operating solar (`SUN`), wind (`WND`), and hydro (`WAT`) generators from the official EIA operating-generator-capacity API. It discovers `endPeriod` rather than assuming the current calendar month, then retrieves every page of that single monthly snapshot. Hydro includes technologies classified as water by EIA, including pumped storage where present.

Generators are deduplicated by plant/generator ID and combined into plants. Only valid reported coordinates and nameplate capacity are used. Missing locations are never replaced with state centers. Capacity is not electricity generation; filtering technologies recomputes the displayed capacities. This is utility-scale inventory coverage, not rooftop solar or every renewable installation. Data is preliminary and can be revised.

The authenticated endpoint is `GET /api/v1/environment/energyPlants`, mounted under the existing environment router. Backend and frontend caches expire after 24 hours; upstream inventory updates are monthly. Failed or incomplete downloads are not cached as successful snapshots.

Set `EIA_API_KEY` in the backend environment using a free key from https://www.eia.gov/opendata/register.php. The rate-limited public `DEMO_KEY` is a local-preview fallback, not a production credential. Keys never reach frontend responses. No new packages are required.

Circles use the same bounded plant-count size scale as Toxic Area. Their sizes and labels reflect the number of plants in each group at the current zoom, not capacity or generator count. Colors represent solar, wind, and hydro; multi-color circles show their capacity shares. Zoom splits groups to exact reported plant locations. Only circles near the viewport are rendered at detailed zooms. Plant toggles and technology filters reuse `selectedLayers`, including reset and saved-profile restoration.

Run backend tests with `npm test` in `backend`. Run frontend datapoint tests in `frontend` with `node --import tsx --test client/src/lib/datapoint-map-style.test.ts client/src/lib/energy-plants.test.ts`, followed by `npm run build`.

Sources: https://www.eia.gov/electricity/data/eia860m/ and https://www.eia.gov/opendata/documentation.php.
