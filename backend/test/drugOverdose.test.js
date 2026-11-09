import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import express from "express";
import auth from "../middleware/auth.js";
import healthRoutes from "../routes/health.js";
import { fetchOverdosePeriods, parseCountyPopulations, normalizeOverdoseCounty, fetchOverdoseCounties } from "../services/drugOverdose.js";

const csv = "SUMLEV,STATE,COUNTY,CTYNAME,POPESTIMATE2020,POPESTIMATE2025\n040,01,000,Alabama,5000000,5200000\n050,01,001,Autauga County,100000,120000\n";
const populations = parseCountyPopulations(csv);
const period = { period: "2026-03", endDate: "2026-03-31T00:00:00.000", dataAsOf: "2026-10-04", count: 1 };
const row = { fips: "1001", countyname: "Autauga", st_abbrev: "AL", provisional_drug_overdose: "24", monthendingdate: period.endDate, data_as_of: "2026-10-04T00:00:00.000", percentage_of_records_pending: "2.5" };

test("overdose rates use matching county population and explicitly retain its year", () => {
  const normalized = normalizeOverdoseCounty(row, period.period, populations);
  assert.equal(normalized.fips, "01001");
  assert.equal(normalized.name, "Autauga County");
  assert.equal(normalized.count, 24);
  assert.equal(normalized.populationYear, 2025);
  assert.equal(normalized.rate, 20);
  const historical = normalizeOverdoseCounty({ ...row, monthendingdate: "2020-03-31T00:00:00.000" }, "2020-03", populations);
  assert.equal(historical.populationYear, 2020);
  assert.equal(historical.rate, 24);
  const unmatched = normalizeOverdoseCounty({ ...row, fips: "01003" }, period.period, populations);
  assert.equal(unmatched.count, 24);
  assert.equal(unmatched.rate, null);
  assert.equal(unmatched.population, null);
});

test("overdose normalization distinguishes suppressed, missing, and true zero counts", () => {
  const suppressed = normalizeOverdoseCounty({ ...row, provisional_drug_overdose: undefined, footnote: "Counts between 1-9 are suppressed" }, period.period, populations);
  assert.equal(suppressed.countStatus, "suppressed");
  assert.equal(suppressed.count, null);
  assert.equal(suppressed.rate, null);
  for (const invalid of [null, undefined, "", " ", true, -1, Infinity, "not a count", 10.5]) {
    const result = normalizeOverdoseCounty({ ...row, provisional_drug_overdose: invalid }, period.period, populations);
    assert.equal(result.countStatus, "unavailable");
    assert.equal(result.rate, null);
  }
  assert.equal(normalizeOverdoseCounty({ ...row, provisional_drug_overdose: "5" }, period.period, populations).countStatus, "suppressed");
  const zero = normalizeOverdoseCounty({ ...row, provisional_drug_overdose: "0" }, period.period, populations);
  assert.equal(zero.count, 0);
  assert.equal(zero.rate, 0);
  assert.equal(zero.countStatus, "reported");
  assert.equal(normalizeOverdoseCounty({ ...row, fips: "01000" }, period.period, populations), null);
  assert.equal(normalizeOverdoseCounty({ ...row, monthendingdate: "2025-03-31" }, period.period, populations), null);
});

test("population parser rejects malformed tables and never substitutes a different county", () => {
  assert.equal(populations.counties.size, 1);
  assert.equal(populations.counties.has("01000"), false);
  assert.throws(() => parseCountyPopulations("<html>offline</html>"));
  assert.throws(() => parseCountyPopulations(csv.split("\n").slice(0, 2).join("\n")));
});

test("overdose reporting periods come from CDC, sort chronologically, and reject invalid metadata", async () => {
  const metadata = { monthendingdate: period.endDate, data_as_of: row.data_as_of, counties: "3144" };
  const result = await fetchOverdosePeriods(async () => [
    { ...metadata, monthendingdate: "2025-12-31T00:00:00.000" }, metadata,
  ]);
  assert.equal(result[0].period, "2026-03");
  assert.equal(result[0].count, 3144);
  await assert.rejects(fetchOverdosePeriods(async () => []));
  await assert.rejects(fetchOverdosePeriods(async () => [{ ...metadata, counties: "bad" }]));
  await assert.rejects(fetchOverdosePeriods(async () => [metadata, metadata]));
});

test("overdose pagination deduplicates retired city aliases without summing deaths", async () => {
  const queries = [];
  const result = await fetchOverdoseCounties({ ...period, count: 3 }, populations, async (query) => {
    queries.push(query);
    return queries.length === 1 ? [row, { ...row, countyname: "Retired city alias" }] : [{ ...row, fips: "01003" }];
  });
  assert.equal(queries[1].$offset, 2);
  assert.equal(queries[0].$order, "fips ASC,countyname ASC");
  assert.equal(result.counties.length, 2);
  assert.equal(result.counties[0].count, 24);
  assert.equal(result.duplicateCountyRecords, 1);
  const conflict = await fetchOverdoseCounties({ ...period, count: 2 }, populations, async () => [row, { ...row, provisional_drug_overdose: "40" }]);
  assert.equal(conflict.counties[0].countStatus, "unavailable");
  assert.equal(conflict.counties[0].rate, null);
  assert.match(conflict.counties[0].dataNote, /conflicting/);
});

test("overdose snapshots reject missing pages and mixed dates or releases", async () => {
  await assert.rejects(fetchOverdoseCounties(period, populations, async () => []), /incomplete/);
  await assert.rejects(fetchOverdoseCounties(period, populations, async () => [{ ...row, data_as_of: "2025-01-01" }]), /mixed/);
  await assert.rejects(fetchOverdoseCounties(period, populations, async () => [{ ...row, monthendingdate: "2026-02-28T00:00:00.000" }]), /mixed/);
});

test("overdose health route validates periods, enforces authentication, retries failures, and caches a complete response", async (t) => {
  process.env.API_DEV_KEY = "overdose-test-key";
  let snapshotCalls = 0;
  t.mock.method(axios, "get", async (url, { params } = {}) => {
    if (url.includes("census.gov")) return { data: csv };
    if (params.$group) return { data: [{ monthendingdate: period.endDate, data_as_of: row.data_as_of, counties: "1" }] };
    if (++snapshotCalls === 1) throw Object.assign(new Error("CDC rate limited"), { response: { status: 429 } });
    return { data: [row] };
  });
  const app = express();
  app.use("/api/v1/health", auth, healthRoutes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/health/drugOverdoseDeaths`;
  const headers = { "x-api-key": "overdose-test-key" };
  assert.equal((await fetch(base)).status, 401);
  for (const query of ["period=2026-13", "period=2026-03%27", "period=2026-03&period=2025-01"]) assert.equal((await fetch(`${base}?${query}`, { headers })).status, 400);
  assert.equal((await fetch(base, { headers })).status, 503);
  const response = await fetch(base, { headers });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.period, "2026-03");
  assert.deepEqual(data.availablePeriods, ["2026-03"]);
  assert.equal(data.counties[0].rate, 20);
  assert.equal((await fetch(`${base}?period=2026-03`, { headers })).status, 200);
  assert.equal(snapshotCalls, 2);
  assert.equal((await fetch(`${base}?period=2020-01`, { headers })).status, 404);
});
