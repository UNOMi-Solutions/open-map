import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import express from "express";
import { fetchSuperfundSites, normalizeSuperfundSite } from "../services/superfund.js";
import { getCached } from "../utils/dataCache.js";
import environmentRoutes from "../routes/environment.js";
import auth from "../middleware/auth.js";

const sampleSite = {
  OBJECTID: 1, EPA_ID: "AZ0000309013", Site_Name: "IRON KING MINE - HUMBOLDT SMELTER",
  LATITUDE: 34.5, LONGITUDE: -112.25, State: "AZ", NPL_Status: "Final NPL",
};

// Protect precise locations, complete EPA pagination, and authenticated API failure handling.
test("Superfund normalization rejects missing or invalid coordinates without inventing locations", () => {
  const normalized = normalizeSuperfundSite({ ...sampleSite, LATITUDE: "34.5", FACILITY_URL: "javascript:alert(1)" });
  assert.equal(normalized.latitude, 34.5);
  assert.equal(normalized.longitude, -112.25);
  assert.equal(normalized.status, "Final NPL");
  assert.equal(normalized.sourceUrl, "https://enviro.epa.gov/envirofacts/sems/detail-view?id=AZ0000309013");
  for (const latitude of [null, undefined, "", " ", "invalid", Infinity, 91, true]) {
    assert.equal(normalizeSuperfundSite({ ...sampleSite, LATITUDE: latitude }), null);
  }
  assert.equal(normalizeSuperfundSite({ ...sampleSite, LONGITUDE: -181 }), null);
  assert.equal(normalizeSuperfundSite({ ...sampleSite, LATITUDE: 0, LONGITUDE: 0 }), null);
  assert.equal(normalizeSuperfundSite(null), null);
});

test("Superfund fetch pages through all records and deduplicates repeated EPA site IDs", async () => {
  const queries = [];
  const result = await fetchSuperfundSites(async (query) => {
    queries.push(query);
    return queries.length === 1 ? {
      features: [{ attributes: sampleSite }, { attributes: { ...sampleSite, EPA_ID: "AZ0000000000", LATITUDE: null } }],
      exceededTransferLimit: true,
    } : {
      features: [{ attributes: sampleSite }, { attributes: { ...sampleSite, EPA_ID: "AZ0000000001", Site_Name: "Another site" } }],
    };
  });
  assert.equal(queries.length, 2);
  assert.equal(queries[1].resultOffset, 2);
  assert.equal(queries[0].orderByFields, "OBJECTID ASC");
  assert.equal(queries[0].returnGeometry, false);
  assert.equal(result.total, 2);
  assert.equal(result.excludedSiteCount, 1);
  assert.equal(result.sites[0].name, "Another site");
});

test("Superfund fetch refuses upstream errors and incomplete empty pages", async () => {
  await assert.rejects(fetchSuperfundSites(async () => ({ error: { code: 500 } })), /Invalid EPA/);
  await assert.rejects(fetchSuperfundSites(async () => ({ features: [], exceededTransferLimit: true })), /incomplete page/);
});

test("shared cache coalesces concurrent failures, clears them, and allows retry", async () => {
  let calls = 0;
  const failedFetch = async () => { calls += 1; throw new Error("upstream unavailable"); };
  const first = getCached("test:superfund:failure", 1000, failedFetch);
  const second = getCached("test:superfund:failure", 1000, failedFetch);
  assert.equal(first, second);
  await assert.rejects(first, /upstream unavailable/);
  await assert.rejects(second, /upstream unavailable/);
  assert.equal(calls, 1);
  assert.equal(await getCached("test:superfund:failure", 1000, async () => "recovered"), "recovered");
});

test("Superfund environment routes enforce auth, validate IDs, cache data, and recover from EPA failures", async (t) => {
  process.env.API_DEV_KEY = "superfund-test-key";
  let requests = 0;
  let boundaryAttempts = 0;
  t.mock.method(axios, "get", async (_url, { params }) => {
    requests += 1;
    if (params.returnGeometry === true) {
      boundaryAttempts += 1;
      if (boundaryAttempts === 1) throw new Error("EPA temporarily offline");
      return { data: { type: "FeatureCollection", features: [{ type: "Feature", properties: { EPA_ID: sampleSite.EPA_ID }, geometry: { type: "Polygon", coordinates: [[[-112.25, 34.5], [-112.24, 34.5], [-112.24, 34.51], [-112.25, 34.5]]] } }] } };
    }
    return { data: { features: [{ attributes: sampleSite }] } };
  });
  const app = express();
  app.use("/api/v1/environment", auth, environmentRoutes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/environment/superfundSites`;
  const headers = { "x-api-key": "superfund-test-key" };
  assert.equal((await fetch(baseUrl)).status, 401);
  const list = await fetch(baseUrl, { headers });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).sites[0].id, sampleSite.EPA_ID);
  await fetch(baseUrl, { headers });
  assert.equal(requests, 1);
  assert.equal((await fetch(`${baseUrl}/invalid/boundary`, { headers })).status, 400);
  const boundaryUrl = `${baseUrl}/${sampleSite.EPA_ID}/boundary`;
  assert.equal((await fetch(boundaryUrl, { headers })).status, 502);
  const recovered = await fetch(boundaryUrl, { headers });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).features[0].geometry.type, "Polygon");
  await fetch(boundaryUrl, { headers });
  assert.equal(boundaryAttempts, 2);
});
