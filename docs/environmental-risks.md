# Nationwide environmental layers

Fracking Locations and Industrial Runoff load complete nationwide inventories automatically. They use the same 64-pixel zoom-dependent grouping and count-to-circle-size function as Toxic Area and Energy Plants. Markers are borderless with 85 percent opacity; groups split on zoom and retain individual source coordinates. Coincident records remain accessible together. Source-linked detail popups use the existing map design.

Toxic Water Supply uses a nationwide county choropleth like Drug Overdose Deaths: red intensity, white county outlines, 68 percent fill opacity, an explicit unavailable-data category, and clickable county details. It summarizes counts of systems carrying EPA health-based violation flags. It does not place guessed water-system markers or imply county-wide household contamination.

There is no state selector. Clicking a state only navigates the map; it does not filter these datasets. Existing saved state selections are ignored. Reporting-year selections remain saved with map profiles and clear with Reset all filters.

## Sources and routes

- Fracking: `GET /api/v1/environment/frackingLocations?year=2025`. The public FracFocus well finder provides well coordinates and reported hydraulic fracturing jobs. The adapter retrieves every page of the selected completion year, validates dates and coordinates, and retains each well's latest reported job within that year. Default year is the previous calendar year. Source: https://www.fracfocus.org/wells
- Industrial releases: `GET /api/v1/environment/industrialRunoff?year=2024`. EPA TRI's smaller official annual exports are retrieved automatically for all 50 states and D.C. because its full U.S. export fails for large years. Each CSV is streamed rather than buffered; results are merged and deduplicated into one national response only after every export succeeds. Only compact positive surface-water release records are retained. Chemical quantities retain their original units; dioxin grams are not added to pounds, and very small positive quantities use scientific notation. Default year is two calendar years before the current year to allow publication lag. Source: https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present
- Drinking water: `GET /api/v1/environment/drinkingWater`. EPA ECHO limits individual searches below the national active-system count. The backend automatically retrieves all ten EPA regions with bounded concurrency and complete pagination, then deduplicates them into one national snapshot. Compact source columns reduce download size. County totals use all active systems; the response includes detailed records only for flagged systems, keeping browser payloads manageable. No partial national response is cached or displayed if a region fails. Source: https://echo.epa.gov/tools/web-services/facility-search-drinking-water

All routes inherit existing environment API authentication. State parameters remain optional for older API consumers; the map always requests national data. Cache keys separate national inventories from previous state responses. Concurrent requests share one in-flight download and only complete successful snapshots are cached.

## Interpretation

FracFocus disclosures are operator-submitted and coverage is incomplete. A reported historical job does not establish current well activity.

TRI Basic water-release totals include process discharges and do not isolate stormwater runoff. Points represent facilities, not exact pipe outlets, contaminated-water boundaries, violations, or exposure risk. The layer is labeled Water Releases accordingly.

Drinking-water health flags include contaminant limits, residual disinfectant limits, and treatment techniques. Monitoring/reporting-only violations do not increment the flagged count. Unknown flags and unmatched counties remain distinct from zero. A system can serve multiple counties, so county totals cannot be added as unique statewide/national systems or populations. County coverage is not a service-area boundary. EPA reporting lags current conditions; retrieval date does not imply current water safety.

## Verification

Tests cover national multi-state TRI streaming, all ten water regions, complete pagination and failure handling, countrywide cluster sizing/splitting, deduplication, units, invalid dates/coordinates, county coverage, authentication, and retries. Browser checks verify automatic nationwide loading without a state selection, national marker groups, and county selection/popups.
