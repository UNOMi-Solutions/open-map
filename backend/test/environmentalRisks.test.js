import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import axios from "axios";
import { Readable } from "node:stream";
import auth from "../middleware/auth.js";
import routes from "../routes/environmentalRisks.js";
import { fetchFracking, normalizeFracking, normalizeRunoff, normalizeWater, fetchDrinkingWater, fetchRunoff, fetchNationalRunoff } from "../services/environmentalRisks.js";

const well = { APINumber: "42227368950000", WellName: "Example", StateName: "Texas", CountyName: "Howard", Latitude: 32.1, Longitude: -101.5, JobEndDate: "10/16/2025 4:14:00 AM", TotalBaseWaterVolume: 0 };
const water = { PWSId: "AZ0407280", PWSName: "Example water system", StateCode: "AZ", PWSActivityCode: "A", HealthFlag: "Yes", FIPSCodes: "04013,04015,04013", RegistryID: "110013256859" };
const tri = { "1. YEAR": "2024", "2. TRIFD": "FACILITY1", "4. FACILITY NAME": "Example", "8. ST": "AZ", "12. LATITUDE": "33.5", "13. LONGITUDE": "-111.5", "53. 5.3 - WATER": "10", "50. UNIT OF MEASURE": "Pounds", "37. CHEMICAL": "Copper" };

test("fracking uses verified dates and coordinates, retains zero volumes, and excludes invalid years and locations", () => {
  assert.equal(normalizeFracking(well, 2025).details.find(([k]) => k === "Base water")[1], "0 gallons");
  const formatted = normalizeFracking({ ...well, TotalBaseWaterVolume: "1,234", TVD: "5,678" }, 2025);
  assert.equal(formatted.details.find(([k]) => k === "Base water")[1], "1,234 gallons");
  assert.equal(formatted.details.find(([k]) => k === "True vertical depth")[1], "5,678 feet");
  for (const values of [{ Latitude: null }, { Latitude: "" }, { Longitude: 181 }, { JobEndDate: "4/1/3012 12:00:00 AM" }, { JobEndDate: "2/30/2025" }, { JobEndDate: "99/99/2025" }, { JobEndDate: "1/1/2024" }, { APINumber: "javascript:bad" }, { StateName: "Unknown" }]) assert.equal(normalizeFracking({ ...well, ...values }, 2025), null);
});

test("fracking exhausts pagination, deduplicates wells, keeps latest job, and refuses partial results", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ ...well, APINumber: String(42227368000000 + i) }));
  const queries = [];
  const data = await fetchFracking(2025, async (_url, params) => {
    queries.push(params);
    return { Count: 1001, Wells: params.page === 1 ? rows : [{ ...rows[0], JobEndDate: "11/1/2025" }] };
  });
  assert.equal(queries.length, 2);
  assert.equal(queries[1].page, 2);
  assert.equal(data.points.length, 1000);
  assert.equal(data.points[0].date, "2025-11-01");
  await assert.rejects(fetchFracking(2025, async () => ({ Count: 10, Wells: [well] })), /Incomplete/);
  await assert.rejects(fetchFracking(2025, async () => ({ Count: 0 })), /Invalid/);
});

test("TRI maps positive water releases only, filters year/state, and keeps grams separate from pounds", () => {
  const result = normalizeRunoff([tri, { ...tri, "37. CHEMICAL": "Dioxin", "50. UNIT OF MEASURE": "Grams", "53. 5.3 - WATER": "0.0002" },
    { ...tri, "2. TRIFD": "zero", "53. 5.3 - WATER": "0" }, { ...tri, "2. TRIFD": "missing", "53. 5.3 - WATER": "" },
    { ...tri, "8. ST": "TX" }, { ...tri, "1. YEAR": "2023" }, { ...tri, "12. LATITUDE": "" }], "AZ", 2024);
  assert.equal(result.points.length, 1);
  assert.equal(result.excluded, 1);
  assert.deepEqual(result.points[0].details.slice(-2), [["Copper", "10 pounds to surface water"], ["Dioxin", "0.0002 grams to surface water"]]);
  const tiny = normalizeRunoff([{ ...tri, "53. 5.3 - WATER": "0.00000001", "50. UNIT OF MEASURE": "Grams" }], "AZ", 2024);
  assert.match(tiny.points[0].details.at(-1)[1], /1\.000e-8 grams/);
});

test("TRI rejects HTML and truncated CSV instead of treating missing releases as zero", async () => {
  await assert.rejects(fetchRunoff("AZ", 2024, async () => "<html>unavailable</html>"), /invalid/);
  await assert.rejects(fetchRunoff("AZ", 2024, async () => '1. YEAR,2. TRIFD\n2024,"unfinished'), /Incomplete/);
  await assert.rejects(fetchRunoff("AZ", 2024, async () => '1. YEAR,2. TRIFD\n2024,example'), /invalid column headers/);
});

test("national TRI streams the U.S. download and retains releases in multiple states", async () => {
  const rows = [tri, { ...tri, "2. TRIFD": "FACILITY2", "8. ST": "TX" }];
  const keys = ["1. YEAR", "2. TRIFD", "4. FACILITY NAME", "6. CITY", "7. COUNTY", "8. ST", "12. LATITUDE", "13. LONGITUDE", "23. INDUSTRY SECTOR", "37. CHEMICAL", "50. UNIT OF MEASURE", "53. 5.3 - WATER"];
  const csv = keys.join(",") + "\n" + rows.map(row => keys.map(k => row[k] || "").join(",")).join("\n");
  const result = await fetchRunoff(null, 2024, async url => {
    assert.match(url, /2024_US\/csv$/);
    return Readable.from([csv.slice(0, 150), csv.slice(150)]);
  });
  assert.deepEqual(result.points.map(p => p.state), ["AZ", "TX"]);
  await assert.rejects(fetchRunoff(null, 2024, async () => Readable.from(["<html>error</html>"])), /invalid/);
});

test("national water joins every EPA region and retains county totals while returning flagged-system details", async () => {
  const regions = new Set();
  const result = await fetchDrinkingWater(null, async (url, params) => {
    if (url.endsWith("get_systems")) {
      assert.equal(params.p_st, undefined);
      assert.equal(params.responseset, 5000);
      regions.add(params.p_reg);
      return { Results: { QueryRows: "2", QueryID: String(Number(params.p_reg)) } };
    }
    return { Results: { QueryRows: "2", WaterSystems: [
      { ...water, PWSId: `AZ${String(Number(params.qid) * 2).padStart(7, "0")}` },
      { ...water, PWSId: `AZ${String(Number(params.qid) * 2 + 1).padStart(7, "0")}`, HealthFlag: "No" },
    ] } };
  });
  assert.equal(regions.size, 10);
  assert.equal(result.totalSystems, 20);
  assert.equal(result.systems.length, 10);
  assert.equal(result.counties[0].total, 20);
  assert.equal(result.counties[0].flagged, 10);
  assert.equal(result.counties[0].systemIds.length, 10);
});

test("national industrial inventory includes every state and rejects partial coverage", async () => {
  const states = new Set();
  const result = await fetchNationalRunoff(2024, async state => {
    states.add(state);
    return { year: 2024, excluded: 0, points: [{ id: state, state }] };
  });
  assert.equal(states.size, 51);
  assert.equal(result.points.length, 51);
  assert.ok(states.has("AK") && states.has("HI") && states.has("DC"));
  await assert.rejects(fetchNationalRunoff(2024, async state => {
    if (state === "TX") throw new Error("EPA unavailable");
    return { year: 2024, excluded: 0, points: [] };
  }), /EPA unavailable/);
});

test("water counties count unique active systems and health flags, not population or reporting-only violations", () => {
  const result = normalizeWater([water, water, { ...water, PWSId: "AZ0407281", HealthFlag: "No", MrFlag: "Yes" },
    { ...water, PWSId: "AZ0407282", HealthFlag: null }, { ...water, PWSId: "AZ0407283", PWSActivityCode: "N" },
    { ...water, PWSId: "AZ0407284", FIPSCodes: null }]);
  assert.equal(result.systems.length, 4);
  assert.equal(result.counties.length, 2);
  assert.deepEqual(result.counties[0], { fips: "04013", total: 3, flagged: 1, unknown: 1, systemIds: ["AZ0407280", "AZ0407281", "AZ0407282"] });
  assert.equal(result.unmappedSystems, 1);
});

test("water retrieves all QID pages and refuses duplicate or incomplete pages", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ ...water, PWSId: `AZ${String(i).padStart(7, "0")}` }));
  const data = await fetchDrinkingWater("AZ", async (url, params) => url.endsWith("get_systems") ? { Results: { QueryRows: "1001", QueryID: "123" } }
    : { Results: { QueryRows: "1001", WaterSystems: params.pageno === 1 ? rows : [{ ...water, PWSId: "AZ9999999" }] } });
  assert.equal(data.systems.length, 1001);
  await assert.rejects(fetchDrinkingWater("AZ", async url => url.endsWith("get_systems") ? { Results: { QueryRows: "2", QueryID: "123" } }
    : { Results: { QueryRows: "2", WaterSystems: [water, water] } }), /Incomplete/);
  await assert.rejects(fetchDrinkingWater("AZ", async () => ({ Results: { Error: { ErrorMessage: "unavailable" } } })), /Invalid/);
});

test("new routes enforce authentication and query validation and recover after source errors", async t => {
  process.env.API_DEV_KEY = "environment-risk-test";
  let calls = 0;
  t.mock.method(axios, "get", async () => {
    if (++calls === 1) throw Object.assign(new Error("Rate limited"), { response: { status: 429 } });
    const fields = ["1. YEAR", "2. TRIFD", "4. FACILITY NAME", "6. CITY", "7. COUNTY", "8. ST", "12. LATITUDE", "13. LONGITUDE", "23. INDUSTRY SECTOR", "37. CHEMICAL", "50. UNIT OF MEASURE", "53. 5.3 - WATER"];
    return { data: `${fields.join(",")}\n${fields.map(field => tri[field] || "").join(",")}` };
  });
  const app = express(); app.use("/environment", auth, routes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/environment`;
  const headers = { "x-api-key": "environment-risk-test" };
  assert.equal((await fetch(`${base}/industrialRunoff?state=AZ&year=2024`)).status, 401);
  for (const path of ["industrialRunoff?state=AZ&year=bad", "frackingLocations?state=../../etc&year=2025", "drinkingWater?state=ZZ"]) assert.equal((await fetch(`${base}/${path}`, { headers })).status, 400);
  const url = `${base}/industrialRunoff?state=AZ&year=2024`;
  assert.equal((await fetch(url, { headers })).status, 503);
  assert.equal((await fetch(url, { headers })).status, 200);
  assert.equal((await fetch(url, { headers })).status, 200);
  assert.equal(calls, 2);
});
