# SPLC Hate Map (tabular import)

The map reads **`by-state-geoid.json`**, committed after running:

```bash
npm run data:splc
```

Or with your own SPLC CSV export:

```bash
npm run data:splc -- path/to/download.csv
```

1. Visit [splcenter.org/hate-map](https://www.splcenter.org/hate-map) (and use the official **download / export data** affordance once you have exported the table).
2. Save the CSV into this repo or pass its path as the CLI argument above.
3. The build script aggregates **one row per listed group**, grouped by whichever column looks like **`State`** (full name or `CA`, `TX`, etc.).
4. `by-state-geoid.json` maps **two-digit Census state GEOIDs** (`"01"`…`"56"`) → **count**, matching **`/geo/us-states.geojson`** feature IDs.

The map toggle lives under sidebar **Social** (“SPLC hate & antigovernment groups (by state HQ)”).

### Front end vs backend

This dataset is small and attribution-only; **`client/public/data/splc/by-state-geoid.json` is fetched by the browser** like other static JSON maps. Use the server only if you later need scraping, SPLC-blocking Cloudflare avoidance, or to hide preprocessing—none of which applies to a CSV you paste in locally.
