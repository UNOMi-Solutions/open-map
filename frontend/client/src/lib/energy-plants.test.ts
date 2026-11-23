import test from "node:test";
import assert from "node:assert/strict";
import { ENERGY_COLORS, EnergyPlant, energyCircleDiameter, energyGroupBackground, energyGroupColor, filterEnergyPlants } from "./energy-plants";
import { groupLocationSites, superfundCircleDiameter } from "./datapoint-map-style";

const plant: EnergyPlant = { id: "1", name: "Mixed plant", state: "AZ", county: "Example", operator: "Example",
  latitude: 34, longitude: -112, capacityMw: 120, generatorCount: 3,
  types: { solar: { capacityMw: 20, generatorCount: 2, technologies: ["Solar Photovoltaic"] }, wind: { capacityMw: 100, generatorCount: 1, technologies: ["Onshore Wind Turbine"] } } };

test("Energy filters recompute capacity, generator count and colors without changing source data", () => {
  const solar = filterEnergyPlants([plant], ["solar"]);
  assert.equal(solar[0].capacityMw, 20);
  assert.equal(solar[0].generatorCount, 2);
  assert.equal(energyGroupColor(solar), ENERGY_COLORS.solar);
  assert.equal(energyGroupColor([plant]), ENERGY_COLORS.mixed);
  assert.equal(energyGroupBackground(solar), ENERGY_COLORS.solar);
  assert.ok(energyGroupBackground([plant]).startsWith("conic-gradient("));
  assert.ok(energyGroupBackground([plant]).includes(ENERGY_COLORS.wind));
  assert.deepEqual(filterEnergyPlants([plant], ["hydro"]), []);
  assert.deepEqual(filterEnergyPlants([plant], []), []);
  assert.equal(plant.capacityMw, 120);
});

test("Energy circles match Toxic Area count sizing at every zoom grouping", () => {
  assert.equal(energyCircleDiameter(1), 18);
  assert.ok(energyCircleDiameter(10) > energyCircleDiameter(2));
  for (const count of [1, 2, 10, 50, 1000]) assert.equal(energyCircleDiameter(count), superfundCircleDiameter(count));
  assert.equal(energyCircleDiameter(1000), 64);
});

test("Energy clusters split to exact plant coordinates at detailed zoom", () => {
  const plants = [plant, { ...plant, id: "2", longitude: -111.99 }];
  assert.equal(groupLocationSites(plants, 4, () => ({ x: 10, y: 10 })).length, 1);
  const split = groupLocationSites(plants, 14, () => ({ x: 10, y: 10 }));
  assert.equal(split.length, 2);
  assert.ok(energyCircleDiameter(plants.length) > energyCircleDiameter(split[0][1].length));
  assert.deepEqual(split.map(([, [plant]]) => plant.longitude), [-112, -111.99]);
});
