import { superfundCircleDiameter } from "./datapoint-map-style";

export const ENERGY_TYPES = ["solar", "wind", "hydro"] as const;
export type EnergyType = typeof ENERGY_TYPES[number];
export const ENERGY_COLORS = { solar: "#ff9500", wind: "#0d9488", hydro: "#2563eb", mixed: "#7c3aed" };

export interface EnergyPlant {
  id: string;
  name: string;
  state: string;
  county: string;
  operator: string;
  latitude: number;
  longitude: number;
  capacityMw: number;
  generatorCount: number;
  types: Partial<Record<EnergyType, { capacityMw: number; generatorCount: number; technologies: string[] }>>;
}

// Filtering recomputes plant capacity instead of retaining totals from hidden technologies.
export function filterEnergyPlants(plants: EnergyPlant[], types: readonly EnergyType[]): EnergyPlant[] {
  return plants.flatMap((plant) => {
    const selected = types.filter((type) => plant.types[type]);
    if (!selected.length) return [];
    return [{ ...plant, types: Object.fromEntries(selected.map((type) => [type, plant.types[type]])),
      capacityMw: selected.reduce((sum, type) => sum + plant.types[type]!.capacityMw, 0),
      generatorCount: selected.reduce((sum, type) => sum + plant.types[type]!.generatorCount, 0) }];
  });
}

// Energy groups use the same plant-count size scale as Toxic Area site groups.
export function energyCircleDiameter(plantCount: number): number {
  return superfundCircleDiameter(plantCount);
}

export function energyGroupColor(plants: EnergyPlant[]): string {
  const types = ENERGY_TYPES.filter((type) => plants.some((plant) => plant.types[type]));
  return types.length === 1 ? ENERGY_COLORS[types[0]] : ENERGY_COLORS.mixed;
}

// Mixed circles show capacity shares rather than hiding technology composition behind one color.
export function energyGroupBackground(plants: EnergyPlant[]): string {
  const types = ENERGY_TYPES.filter((type) => plants.some((plant) => plant.types[type]));
  if (types.length <= 1) return energyGroupColor(plants);
  const capacities = types.map((type) => plants.reduce((sum, plant) => sum + (plant.types[type]?.capacityMw ?? 0), 0));
  const total = capacities.reduce((sum, capacity) => sum + capacity, 0);
  let start = 0;
  const stops = types.map((type, index) => {
    const end = start + (total ? capacities[index] / total : 1 / types.length) * 100;
    const stop = `${ENERGY_COLORS[type]} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(", ")})`;
}
