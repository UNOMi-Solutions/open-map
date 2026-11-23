import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import express from "express";
import auth from "../middleware/auth.js";
import environmentRoutes from "../routes/environment.js";
import { fetchSewageOutfalls, normalizeSewageOutfall } from "../services/sewageDischarge.js";

const row = {
  OBJECTID: 1, npdes_pfid: "IL0045012218", npdes_id: "IL0045012", facility_uin: "110005853932",
  facility_name: "CHICAGO CSO, CITY OF", perm_feature_nmbr: "218", perm_feature_text: "CSO - LAFLIN AVENUE NORTH",
  pf_lat: 41.655833, pf_lon: -87.658056, facility_lat: 42.011944, facility_lon: -87.71,
  pf_character: "CSO", pf_state_waterbody_name: "CALUMET SAG CHANNEL", permit_status_code: "EFF",
};

test("sewage markers use outfall coordinates, reject missing locations, and exclude closed/non-CSO records", () => {
  const outfall = normalizeSewageOutfall(row);
  assert.equal(outfall.latitude, row.pf_lat);
  assert.equal(outfall.longitude, row.pf_lon);
  assert.notEqual(outfall.latitude, row.facility_lat);
  assert.equal(outfall.sourceUrl, "https://echo.epa.gov/detailed-facility-report?fid=110005853932");
  assert.equal(outfall.treatment, "Untreated CSO");
  assert.equal(normalizeSewageOutfall({ ...row, pf_character: "TCS" }).treatment, "Treated CSO");
  for (const value of [null, undefined, "", " ", true, Infinity, 91]) assert.equal(normalizeSewageOutfall({ ...row, pf_lat: value }), null);
  assert.equal(normalizeSewageOutfall({ ...row, pf_lon: -181 }), null);
  assert.equal(normalizeSewageOutfall({ ...row, pf_lat: 0, pf_lon: 0 }), null);
  for (const code of ["CLS", "CSO,CLS", "DSW", ""]) assert.equal(normalizeSewageOutfall({ ...row, pf_character: code }), null);
  assert.equal(normalizeSewageOutfall(null), null);
  assert.equal(normalizeSewageOutfall({ ...row, npdes_pfid: "" }), null);
  assert.match(normalizeSewageOutfall({ ...row, facility_uin: "javascript:alert(1)" }).sourceUrl, /^https:\/\/echo.epa.gov\/tools\//);
});

test("sewage inventory pages all outfalls, deduplicates IDs, and reports omitted records", async () => {
  const queries = [];
  const data = await fetchSewageOutfalls(async (query) => {
    queries.push(query);
    return queries.length === 1 ? { features: [{ attributes: row }, { attributes: { ...row, npdes_pfid: "bad", pf_lat: null } }], exceededTransferLimit: true }
      : { features: [{ attributes: row }, { attributes: { ...row, OBJECTID: 2, npdes_pfid: "IL0045012219", perm_feature_nmbr: "219" } }] };
  });
  assert.equal(queries[0].orderByFields, "OBJECTID ASC");
  assert.equal(queries[1].resultOffset, 2);
  assert.equal(data.total, 2);
  assert.equal(data.excludedOutfallCount, 1);
  assert.equal(data.outfalls[1].outfallNumber, "219");
});

test("sewage inventory refuses upstream errors and incomplete pages", async () => {
  await assert.rejects(fetchSewageOutfalls(async () => ({ error: { code: 500 } })), /Invalid EPA/);
  await assert.rejects(fetchSewageOutfalls(async () => ({ features: [], exceededTransferLimit: true })), /incomplete/);
});

test("sewage route requires API authentication, recovers from upstream failure, and caches success", async (t) => {
  process.env.API_DEV_KEY = "sewage-test-key";
  let calls = 0;
  t.mock.method(axios, "get", async () => {
    if (++calls === 1) throw Object.assign(new Error("Rate limited"), { response: { status: 429 } });
    return { data: { features: [{ attributes: row }] } };
  });
  const app = express();
  app.use("/api/v1/environment", auth, environmentRoutes);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/environment/sewageDischarge`;
  const headers = { "x-api-key": "sewage-test-key" };
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { "x-api-key": "wrong" } })).status, 403);
  assert.equal((await fetch(url, { headers })).status, 503);
  const response = await fetch(url, { headers });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).outfalls[0].waterbody, "CALUMET SAG CHANNEL");
  assert.equal((await fetch(url, { headers })).status, 200);
  assert.equal(calls, 2);
});
