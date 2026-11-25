
import json
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

# Project paths
PROJECT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_DIR / "backend" / ".env")

API_KEY = os.getenv("CENSUS_API_KEY")
YEAR = 2025

# Output directories
POVERTY_DIR = PROJECT_DIR / "frontend/client/public/data/poverty"
INCOME_DIR = PROJECT_DIR / "frontend/client/public/data/income"

POVERTY_DIR.mkdir(parents=True, exist_ok=True)
INCOME_DIR.mkdir(parents=True, exist_ok=True)

# Census ACS 1-Year API
URL = f"https://api.census.gov/data/{YEAR}/acs/acs1"

params = {
    "get": "NAME,B17001_002E,B17001_001E,B19013_001E",
    "for": "county:*",
}

if API_KEY:
    params["key"] = API_KEY

print(f"Fetching {YEAR} ACS 1-Year county data...")

response = requests.get(URL, params=params, timeout=60)
response.raise_for_status()

rows = response.json()
headers = rows[0]

poverty_data = {}
income_data = {}

for values in rows[1:]:
    record = dict(zip(headers, values))

    fips = record["state"] + record["county"]
    name = record["NAME"].split(",")[0]

    # Poverty estimates
    try:
        poverty_count = int(record["B17001_002E"])
        poverty_universe = int(record["B17001_001E"])

        if poverty_count >= 0 and poverty_universe > 0:
            poverty_rate = round(
                poverty_count / poverty_universe * 100, 1
            )

            poverty_data[fips] = {
                "name": name,
                "rate": poverty_rate,
                "count": poverty_count,
            }
    except (TypeError, ValueError):
        pass

    # Median household income
    try:
        income = int(record["B19013_001E"])

        if income >= 0:
            income_data[fips] = {
                "name": name,
                "income": income,
            }
    except (TypeError, ValueError):
        pass

# Save new files without overwriting existing ones
for directory, data in [
    (POVERTY_DIR, poverty_data),
    (INCOME_DIR, income_data),
]:
    output_file = directory / f"{YEAR}.json"

    if output_file.exists():
        print(f"Already exists, skipping: {output_file}")
        continue

    with open(output_file, "w") as file:
        json.dump(data, file, indent=2)

    print(f"Saved {len(data)} counties to {output_file}")

print("Finished!")
