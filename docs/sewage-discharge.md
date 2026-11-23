# Sewage discharge

The Environment option **Sewage Discharge — CSO Outfalls** maps the U.S. EPA National Combined Sewer Overflow Inventory's active outfall feature service. It shows known outlets where combined sewer systems can discharge wastewater mixed with stormwater. It is not a live spill feed, a complete inventory of all sewage discharges, or a measure of contamination intensity.

The API is `GET /api/v1/environment/sewageDischarge`. The existing environment router is mounted behind API-key authentication in `backend/index.js`; no new EPA API key or package is required. The backend pages the official ArcGIS service in stable OBJECTID order and caches only successful inventories for 24 hours. The frontend uses the existing Environment cache lifetime. EPA updates its source inventory weekly.

Markers use `pf_lat` and `pf_lon`, the outfall coordinates. Facility-office coordinates and address geocoding are never substituted. Invalid locations, closed outfalls, and non-CSO classifications are omitted and counted. Records are deduplicated by EPA's combined permit/outfall identifier. EPA acknowledges incomplete coverage and missing coordinates.

Borderless cyan circles at 85% opacity match the existing Environment marker styling. Circle size and count represent the number of outfalls in a group, not flow or pollution severity. Groups split on zoom; coincident outfalls remain selectable together. Popups show facility, outfall, receiving water, treatment classification, permit details, and a safely constructed EPA source link. Loading, retry, empty, and omitted-record states are included. The existing `selectedLayers` state handles default-off visibility, Reset All, and saved-profile restoration.

Sources:
- https://echo.epa.gov/tools/data-downloads/cso-inventory-summary
- https://echo.epa.gov/tools/map-service
- https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Combined_Sewer_Overflows/FeatureServer/0

Validation: run `npm test` in `backend`, the frontend library tests with `node --import tsx --test client/src/lib/*.test.ts`, and `npm run build` in `frontend`.
