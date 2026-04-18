import * as turf from "@turf/turf";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

type Metro = {
  name: string;
  lat: number;
  lng: number;
  population: number;
};

type PopulationGridResult = {
  grid: FeatureCollection<Polygon | MultiPolygon>;
  breaks: number[];
};

type BuildDummyPopulationHeatPointsOptions = {
  /**
   * Deterministic seed so the dummy heatmap looks stable across refreshes/builds.
   * Use any integer.
   */
  seed: number;
  /**
   * How many sample points to generate per 1,000,000 people.
   * Higher = smoother + more expensive.
   */
  pointsPerMillion: number;
  /**
   * Upper bound per metro to avoid huge allocations.
   */
  maxPointsPerMetro: number;
  /**
   * Baseline spread radius in km for the smallest metros; bigger metros spread wider.
   */
  baseSpreadKm: number;
};

type BuildDummyPopulationGridOptions = {
  /**
   * [minLng, minLat, maxLng, maxLat] for the grid bounds (e.g. CONUS).
   */
  bbox: [number, number, number, number];
  /**
   * Grid cell size in kilometers. Larger = fewer cells (faster), smaller = more detail.
   */
  cellSideKm: number;
  /**
   * Gaussian kernel radius in km for the density falloff.
   */
  kernelKm: number;
  /**
   * Number of bins for choropleth classes.
   */
  bins: number;
  /**
   * Optional mask to clip the grid to a shape (e.g., CONUS polygon collection).
   */
  mask?: FeatureCollection<Polygon | MultiPolygon>;
  /**
   * Clipping strategy. "center" keeps cells whose center falls in the mask.
   * "clip" intersects each cell with the mask for a perfect perimeter fit.
   */
  clipMode?: "center" | "clip";
};

// Simple fast deterministic PRNG (Mulberry32)
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function kmToLatDegrees(km: number) {
  // 1 deg latitude ~= 110.574 km
  return km / 110.574;
}

function kmToLngDegrees(km: number, latDeg: number) {
  // 1 deg longitude ~= 111.320*cos(lat) km
  const latRad = (latDeg * Math.PI) / 180;
  const kmPerDeg = 111.32 * Math.cos(latRad);
  // avoid blowups near poles; CONUS-only anyway, but keep safe:
  return kmPerDeg > 1e-6 ? km / kmPerDeg : 0;
}

function quantileBreaks(values: number[], bins: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i <= bins; i++) {
    const idx = Math.min(
      sorted.length - 1,
      Math.floor((i / bins) * sorted.length) - 1
    );
    breaks.push(sorted[Math.max(0, idx)]);
  }
  return breaks;
}

/**
 * Builds a smooth-looking dummy "population density" surface by sampling many
 * points around metro centers. Each point has a small weight; denser metros
 * get more points and thus appear darker.
 *
 * Returns Leaflet.heat points in the form: [lat, lng, weight]
 */
export function buildDummyPopulationHeatPoints(
  metros: Metro[],
  opts: BuildDummyPopulationHeatPointsOptions
): Array<[number, number, number]> {
  if (!metros.length) return [];

  const rand = mulberry32(opts.seed);
  const maxPop = Math.max(...metros.map((m) => m.population));

  // Target a stable upper bound for total points so map interactions stay snappy.
  // (This keeps the dummy layer "professional" even on slower machines.)
  const MAX_TOTAL_POINTS = 22000;

  // First pass: compute intended counts per metro
  const intended = metros.map((m) => {
    const perMetro =
      Math.round((m.population / 1_000_000) * opts.pointsPerMillion) || 1;
    return clamp(perMetro, 1, opts.maxPointsPerMetro);
  });

  // If too many, scale down proportionally.
  const intendedSum = intended.reduce((a, b) => a + b, 0);
  const scale = intendedSum > MAX_TOTAL_POINTS ? MAX_TOTAL_POINTS / intendedSum : 1;

  const points: Array<[number, number, number]> = [];

  for (let i = 0; i < metros.length; i++) {
    const m = metros[i];
    const popRatio = m.population / maxPop; // 0..1

    // Spread: larger metros get wider blobs.
    // sqrt dampens extreme metros a bit.
    const spreadKm = opts.baseSpreadKm * (0.8 + 1.6 * Math.sqrt(popRatio));

    const latSigma = kmToLatDegrees(spreadKm);
    const lngSigma = kmToLngDegrees(spreadKm, m.lat);

    const count = Math.max(1, Math.round(intended[i] * scale));

    // Weight per point: keep metro max around 1.0-ish, but not too stark.
    const baseWeight = clamp(0.25 + 0.75 * popRatio, 0.25, 1.0);

    for (let j = 0; j < count; j++) {
      // Gaussian-ish sampling via Box-Muller
      const u1 = Math.max(rand(), 1e-9);
      const u2 = Math.max(rand(), 1e-9);
      const r = Math.sqrt(-2.0 * Math.log(u1));
      const theta = 2.0 * Math.PI * u2;
      const z0 = r * Math.cos(theta);
      const z1 = r * Math.sin(theta);

      const lat = m.lat + z0 * latSigma;
      const lng = m.lng + z1 * lngSigma;

      // Slight intra-metro variance so blobs have texture without looking noisy.
      const w = clamp(baseWeight * (0.75 + 0.5 * rand()), 0.05, 1.0);
      points.push([lat, lng, w]);
    }
  }

  return points;
}

/**
 * Builds a choropleth-like grid with a continuous density field, better matching
 * "professional" population maps (counties/tracts style).
 */
export function buildDummyPopulationGrid(
  metros: Metro[],
  opts: BuildDummyPopulationGridOptions
): PopulationGridResult {
  const { bbox, cellSideKm, kernelKm, bins, mask, clipMode = "center" } = opts;
  const maxPop = Math.max(...metros.map((m) => m.population));

  const grid = (turf.squareGrid(bbox, cellSideKm, {
    units: "kilometers",
  }) as unknown) as FeatureCollection<Polygon>;

  const maskFeature =
    mask && mask.features.length
      ? ((turf.combine(mask as any) as any)?.features?.[0] ?? null)
      : null;

  const maskForOps =
    maskFeature && clipMode === "clip"
      ? turf.simplify(maskFeature as any, {
          tolerance: 0.05, // ~5km at mid-latitudes; speeds up intersections
          highQuality: false,
        })
      : maskFeature;

  const maskedGrid: FeatureCollection<Polygon | MultiPolygon> = mask
    ? ({
        type: "FeatureCollection",
        features: grid.features.flatMap((cell) => {
          if (!maskForOps) return [];
          if (clipMode === "clip") {
            try {
              if (turf.booleanDisjoint(maskForOps as any, cell as any)) return [];
              if (turf.booleanContains(maskForOps as any, cell as any)) return [cell];
              const clipped = turf.intersect(
                turf.featureCollection([cell as any, maskForOps as any]) as any
              );
              return clipped ? [clipped as any] : [];
            } catch {
              return [];
            }
          }
          const center = turf.center(cell).geometry.coordinates as [number, number];
          try {
            return turf.booleanPointInPolygon(center, maskForOps as any) ? [cell] : [];
          } catch {
            return [];
          }
        }),
      } as FeatureCollection<Polygon | MultiPolygon>)
    : (grid as FeatureCollection<Polygon | MultiPolygon>);

  const kernel = kernelKm;
  const kernel2 = kernel * kernel;

  const densities: number[] = [];

  for (const cell of maskedGrid.features) {
    const center = turf.centerOfMass(cell).geometry.coordinates as [number, number];
    const [lng, lat] = center;

    let density = 0;
    for (const m of metros) {
      const d = turf.distance([lng, lat], [m.lng, m.lat], { units: "kilometers" });
      const popRatio = m.population / maxPop;
      const w = 0.35 + 0.65 * popRatio;
      density += w * Math.exp(-(d * d) / (2 * kernel2));
    }

    cell.properties = {
      ...(cell.properties ?? {}),
      density,
    };
    densities.push(density);
  }

  const breaks = quantileBreaks(densities, bins);
  return { grid: maskedGrid, breaks };
}
