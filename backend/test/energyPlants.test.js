import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import express from "express";
import environmentRoutes from "../routes/environment.js";
import auth from "../middleware/auth.js";
import { fetchEnergyPlants, normalizeEnergyGenerator } from "../services/energyPlants.js";

const period = "2026-07";
const row = { period, plantid: "123", plantName: "Example plant", generatorid: "A", status: "OP",
  energy_source_code: "SUN", latitude: "34.5", longitude: "-112.25", "nameplate-capacity-mw": "25.5", technology: "Solar Photovoltaic" };

// Protect precise locations, operating-only coverage, and complete plant capacity totals.
test("Energy generators reject missing coordinates, invalid capacities, other months and inactive statuses", () => {
  assert.equal(normalizeEnergyGenerator(row, period).capacityMw, 25.5);
  for (const latitude of [null, undefined, "", " ", true, 91, Infinity]) assert.equal(normalizeEnergyGenerator({ ...row, latitude }, period), null);
  for (const capacity of [null, undefined, "", -1, Infinity, true]) assert.equal(normalizeEnergyGenerator({ ...row, "nameplate-capacity-mw": capacity }, period), null);
  assert.equal(normalizeEnergyGenerator({ ...row, status: "OS" }, period), null);
  assert.equal(normalizeEnergyGenerator({ ...row, energy_source_code: "NG" }, period), null);
  assert.equal(normalizeEnergyGenerator({ ...row, period: "2026-06" }, period), null);
  assert.equal(normalizeEnergyGenerator({ ...row, latitude: 0, longitude: 0 }, period), null);
});

test("Energy snapshot discovers latest month, pages deterministically, and aggregates unique generators by plant", async () => {
  const queries = [];
  const data = await fetchEnergyPlants(async (path, query) => {
    if (!path) return { endPeriod: period };
    queries.push(query);
    return { total: "4", data: queries.length === 1 ? [row, { ...row, latitude: null, generatorid: "invalid" }] : [row, { ...row, generatorid: "B", energy_source_code: "WND", technology: "Onshore Wind Turbine", "nameplate-capacity-mw": "100" }] };
  });
  assert.equal(queries[0].get("start"), period);
  assert.equal(queries[0].get("end"), period);
  assert.deepEqual(queries[0].getAll("facets[energy_source_code][]"), ["SUN", "WND", "WAT"]);
  assert.equal(queries[0].get("facets[status][]"), "OP");
  assert.equal(queries[1].get("offset"), "2");
  assert.equal(queries[0].get("sort[1][column]"), "generatorid");
  assert.equal(data.total, 1);
  assert.equal(data.plants[0].generatorCount, 2);
  assert.equal(data.plants[0].capacityMw, 125.5);
  assert.equal(data.plants[0].types.solar.capacityMw, 25.5);
  assert.equal(data.plants[0].latitude, 34.5);
  assert.equal(data.excludedGeneratorCount, 1);
});

test("Energy snapshot refuses malformed, incomplete, changing and mixed-month data", async () => {
  for (const response of [{ total: "bad", data: [] }, { total: "1", data: [] }, { total: "1", data: [{ ...row, period: "2026-06" }] }]) {
    await assert.rejects(fetchEnergyPlants(async (path) => path ? response : { endPeriod: period }));
  }
  await assert.rejects(fetchEnergyPlants(async () => ({ endPeriod: "2026-99" })), /reporting month/);
  let page = 0;
  await assert.rejects(fetchEnergyPlants(async (path) => path ? { total: ++page === 1 ? 2 : 3, data: [row] } : { endPeriod: period }), /changing snapshot/);
});

test("Energy environment route enforces auth, recovers from rate limits, and caches a successful snapshot", async (t) => {
  process.env.API_DEV_KEY = "energy-test-key";
  let calls = 0;
  t.mock.method(axios, "get", async (url) => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("Rate limited"), { response: { status: 429 } });
    return { data: { response: url.endsWith("data/") ? { total: "1", data: [row] } : { endPeriod: period } } };
  });
  const app = express();
  app.use("/api/v1/environment", auth, environmentRoutes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/environment/energyPlants`;
  const headers = { "x-api-key": "energy-test-key" };
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers })).status, 503);
  const response = await fetch(url, { headers });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).plants[0].id, "123");
  await fetch(url, { headers });
  assert.equal(calls, 3);
});
