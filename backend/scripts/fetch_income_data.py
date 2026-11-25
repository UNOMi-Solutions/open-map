
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Project directories
BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "frontend" / "client" / "public" / "data" / "income"

API_URL = "https://api.census.gov/data/timeseries/poverty/saipe"
START_YEAR = 2000
END_YEAR = 2024
HISTORICAL_YEARS = [1989, 1993, 1995, 1997, 1998, 1999]

def load_api_key():
    """Read the Census API key from backend/.env."""
    env_file = BACKEND_DIR / ".env"

    for line in env_file.read_text().splitlines():
        if line.startswith("CENSUS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")

    raise RuntimeError("CENSUS_API_KEY not found in backend/.env")


def fetch_year(year, api_key):
    """Retrieve nationwide county median household income estimates for one year."""
    params = {
        "get": "NAME,SAEMHI_PT",
        "for": "county:*",
        "time": str(year),
        "key": api_key,
    }

    url = API_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "OpenMap-Census-Data-Importer/1.0"},
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        rows = json.load(response)

    headers = rows[0]
    records = {}

    for values in rows[1:]:
        item = dict(zip(headers, values))

        state = item["state"]
        county = item["county"]
        income = item["SAEMHI_PT"]

        if not income or income in ("null", "-"):
            continue

        fips = state.zfill(2) + county.zfill(3)

        records[fips] = {
            "name": item["NAME"],
            "income": int(income),
            }

    return records

def main():
    api_key = load_api_key()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    failures = []

    for year in HISTORICAL_YEARS + list(range(START_YEAR, END_YEAR + 1)):
        output_file = OUTPUT_DIR / f"{year}.json"

        if output_file.exists():
            print(f"Skipping {year} — already downloaded")
            continue
        print(f"Fetching {year}...", flush=True)

        try:
            records = fetch_year(year, api_key)

            if not records:
                raise ValueError("No county records returned")

            output_file = OUTPUT_DIR / f"{year}.json"
            output_file.write_text(
                json.dumps(records, separators=(",", ":")),
                encoding="utf-8",
            )

            print(f"  Saved {len(records)} counties")

        except (urllib.error.URLError, ValueError, KeyError) as error:
            failures.append(year)
            print(f"  Failed: {error}")

        time.sleep(0.3)

    if failures:
        print(f"\nFailed years: {failures}")
    else:
        print("\nAll years downloaded successfully!")


if __name__ == "__main__":
    main()
