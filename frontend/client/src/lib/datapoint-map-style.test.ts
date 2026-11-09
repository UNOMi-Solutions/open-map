import assert from "node:assert/strict";
import test from "node:test";
import { groupSuperfundSites, homeInvasionFill, superfundCircleDiameter } from "./datapoint-map-style";

test("Home Invasions separates missing totals from zero and uses a stable yellow-to-red scale", () => {
  assert.equal(homeInvasionFill(), "#94a3b8");
  assert.equal(homeInvasionFill(NaN), "#94a3b8");
  assert.equal(homeInvasionFill(-1), "#94a3b8");
  assert.equal(homeInvasionFill(0), "hsl(60, 100%, 50%)");
  const hue = (count: number) => Number(homeInvasionFill(count).match(/hsl\(([^,]+)/)?.[1]);
  assert.ok(hue(100) > hue(1000));
  assert.ok(hue(1000) > hue(10000));
  assert.ok(hue(100000) >= 0);
  assert.equal(homeInvasionFill(5000), homeInvasionFill(5000));
});

test("Superfund circles grow with site count, stay bounded, and shrink back to single-site size", () => {
  assert.equal(superfundCircleDiameter(1), 18);
  assert.ok(superfundCircleDiameter(2) > superfundCircleDiameter(1));
  assert.ok(superfundCircleDiameter(10) > superfundCircleDiameter(2));
  assert.equal(superfundCircleDiameter(1000), 64);
  assert.equal(superfundCircleDiameter(1), 18);
});

test("Superfund zoom splits and regroups clusters while retaining every exact site coordinate", () => {
  const sites = [
    { id: "a", latitude: 1, longitude: 1 },
    { id: "b", latitude: 1, longitude: 2 },
    { id: "c", latitude: 1, longitude: 2 },
  ];
  const project = (scale: number) => (latitude: number, longitude: number) => ({ x: longitude * scale, y: latitude * scale });
  assert.equal(groupSuperfundSites(sites, 4, project(10)).length, 1);
  assert.equal(groupSuperfundSites(sites, 8, project(64)).length, 2);
  const individual = groupSuperfundSites(sites, 14, project(64));
  assert.equal(individual.length, 2);
  assert.deepEqual(individual.flatMap(([, sites]) => sites), sites);
  assert.deepEqual(individual[1][1].map(site => site.id), ["b", "c"]);
  assert.equal(groupSuperfundSites(sites, 4, project(10))[0][1].length, 3);
});
