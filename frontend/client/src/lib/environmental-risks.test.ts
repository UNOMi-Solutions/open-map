import test from "node:test";
import assert from "node:assert/strict";
import { groupRiskPoints, RiskPoint, waterCountyColor, WATER_LEGEND } from "./environmental-risks";
const point = (id: string, longitude = -100): RiskPoint => ({ id, name: id, state: "TX", latitude: 32, longitude, sourceUrl: "https://www.fracfocus.org/wells", details: [] });

test("coincident locations stay accessible at maximum zoom and distinct points separate", () => {
  const points = [point("a"), point("b"), point("c", -101)];
  const project = (latitude: number, longitude: number) => ({ x: longitude, y: latitude });
  assert.equal(groupRiskPoints(points, 14, project).length, 2);
  assert.equal(groupRiskPoints(points, 14, project)[0][1].length, 2);
  assert.equal(groupRiskPoints(points, 5, project).flatMap(([, rows]) => rows).length, 3);
});
test("water shading separates unknown coverage from known zero flags and positive counts", () => {
  const county = { fips: "04013", total: 10, flagged: 0, unknown: 0, systemIds: [] };
  assert.equal(waterCountyColor(), WATER_LEGEND[0].color);
  assert.equal(waterCountyColor(county), WATER_LEGEND[1].color);
  assert.equal(waterCountyColor({ ...county, unknown: 1 }), WATER_LEGEND[0].color);
  assert.equal(waterCountyColor({ ...county, flagged: 1 }), WATER_LEGEND[2].color);
  assert.equal(waterCountyColor({ ...county, flagged: 5 }), WATER_LEGEND[3].color);
  assert.equal(waterCountyColor({ ...county, flagged: 6 }), WATER_LEGEND[4].color);
});
