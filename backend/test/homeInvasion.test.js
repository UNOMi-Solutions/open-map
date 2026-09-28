import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomeInvasionUrl,
  fetchHomeInvasionState,
  getHomeInvasionDefinition,
  parseHomeInvasionQuery,
  readResidentialCount,
} from "../services/homeInvasion.js";

// Verifies query validation, FBI response parsing, and the public route contract.
test("parseHomeInvasionQuery returns normalized defaults", () => {
  assert.deepEqual(parseHomeInvasionQuery({}), {
    year: 2026,
  });
});

test("parseHomeInvasionQuery rejects unsupported inputs", () => {
  assert.match(parseHomeInvasionQuery({ year: 2027 }).error, /Year must be between/);
  assert.deepEqual(parseHomeInvasionQuery({ year: 2025 }), { year: 2025 });
});

test("buildHomeInvasionUrl uses the current FBI NIBRS state endpoint", () => {
  const url = new URL(buildHomeInvasionUrl({
    state: "AZ",
    year: 2024,
    offense: "burglary",
    apiKey: "test-key",
    baseUrl: "https://example.test/api/",
  }));

  assert.equal(url.pathname, "/api/nibrs/state/AZ/BUR");
  assert.equal(url.searchParams.get("from"), "01-2024");
  assert.equal(url.searchParams.get("to"), "12-2024");
  assert.equal(url.searchParams.get("type"), "totals");
  assert.equal(url.searchParams.get("API_KEY"), "test-key");
});

test("buildHomeInvasionUrl uses the FBI robbery offense code", () => {
  const url = new URL(buildHomeInvasionUrl({
    state: "NY",
    year: 2023,
    offense: "robbery",
    apiKey: "test-key",
  }));

  assert.equal(url.pathname, "/LATEST/nibrs/state/NY/ROB");
});

test("readResidentialCount reads the current FBI NIBRS response", () => {
  assert.equal(readResidentialCount({ victim: { location: { "Residence/Home": 17 } } }), 17);
  assert.equal(readResidentialCount({ victim: { location: { "Residence/Home": "23" } } }), 23);
  assert.throws(() => readResidentialCount({ victim: { location: {} } }), /Residence\/Home count/);
});

test("fetchHomeInvasionState returns robbery and burglary counts for the pie chart", async () => {
  const requestedUrls = [];
  const result = await fetchHomeInvasionState({
    state: "CA",
    year: 2024,
    apiKey: "test-key",
    fetchJson: async (url) => {
      requestedUrls.push(url);
      const count = url.includes("/ROB?") ? 25 : 125;
      return { victim: { location: { "Residence/Home": count } } };
    },
  });

  assert.deepEqual(result, { robbery: 25, burglary: 125, total: 150, reported: true });
  assert.deepEqual(
    requestedUrls.map((url) => new URL(url).pathname),
    ["/LATEST/nibrs/state/CA/ROB", "/LATEST/nibrs/state/CA/BUR"],
  );
  assert.match(getHomeInvasionDefinition(), /Robbery and burglary/);
});

test("home invasion Express route validates input and returns its normalized contract", async (t) => {
  process.env.FBI_CRIME_KEY = "test-fbi-key";
  const axios = (await import("axios")).default;
  t.mock.method(axios, "get", async (url) => ({
    data: {
      victim: {
        location: { "Residence/Home": url.includes("/ROB?") ? 11 : 22 },
      },
    },
  }));
  const express = (await import("express")).default;
  const crimeRoutes = (await import("../routes/crime.js")).default;
  const app = express();
  app.use("/api/v1/crime", crimeRoutes);

  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1/crime/homeInvasionsByState`;

  const response = await fetch(
    `${baseUrl}?state=AZ&year=2026`,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.state, "AZ");
  assert.equal(body.year, 2026);
  assert.equal(body.provisional, true);
  assert.deepEqual(body.data, { robbery: 11, burglary: 22, total: 33, reported: true });
  assert.equal(body.source, "FBI National Incident-Based Reporting System (NIBRS)");

  const invalidYearResponse = await fetch(
    `${baseUrl}?state=AZ&year=2027`,
  );
  assert.equal(invalidYearResponse.status, 400);

  const invalidStateResponse = await fetch(
    `${baseUrl}?state=XX&year=2024&offense=robbery&entryMethod=force`,
  );
  assert.equal(invalidStateResponse.status, 400);

  const missingStateResponse = await fetch(`${baseUrl}?year=2024`);
  assert.equal(missingStateResponse.status, 400);
});
