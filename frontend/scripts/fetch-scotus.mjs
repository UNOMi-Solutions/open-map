/**
 * Builds client/public/data/supreme-court.json from the current-members roster.
 * Pin location = state centroid (DC included) with a small spread when multiple
 * justices share the same map state. Update ROSTER when membership changes;
 * source of truth: https://www.supremecourt.gov/about/biographies.aspx
 *
 * Run: node scripts/fetch-scotus.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const STATE_CENTERS = {
  AL: [32.806671, -86.79113],
  AK: [61.370716, -152.404419],
  AZ: [33.729759, -111.431221],
  AR: [34.969704, -92.373123],
  CA: [36.116203, -119.681564],
  CO: [39.059811, -105.311104],
  CT: [41.597782, -72.755371],
  DE: [39.318523, -75.507141],
  DC: [38.9072, -77.0369],
  FL: [27.766279, -81.686783],
  GA: [33.040619, -83.643074],
  HI: [21.094318, -157.498337],
  ID: [44.240459, -114.478828],
  IL: [40.349457, -88.986137],
  IN: [39.849426, -86.258278],
  IA: [42.011539, -93.210526],
  KS: [38.5266, -96.726486],
  KY: [37.66814, -84.670067],
  LA: [31.169546, -91.867805],
  ME: [44.693947, -69.381927],
  MD: [39.063946, -76.802101],
  MA: [42.230171, -71.530106],
  MI: [43.326618, -84.536095],
  MN: [45.694454, -93.900192],
  MS: [32.741646, -89.678696],
  MO: [38.456085, -92.288368],
  MT: [46.921925, -110.454353],
  NE: [41.12537, -98.268082],
  NV: [38.313515, -117.055374],
  NH: [43.452492, -71.563896],
  NJ: [40.298904, -74.521011],
  NM: [34.840515, -106.248482],
  NY: [42.165726, -74.948051],
  NC: [35.630066, -79.806419],
  ND: [47.528912, -99.784012],
  OH: [40.388783, -82.764915],
  OK: [35.565342, -96.928917],
  OR: [44.572021, -122.070934],
  PA: [40.590752, -77.209755],
  RI: [41.680893, -71.51178],
  SC: [33.856892, -80.945007],
  SD: [44.299782, -99.438828],
  TN: [35.747845, -86.692345],
  TX: [31.054487, -97.563461],
  UT: [40.150032, -111.862434],
  VT: [44.045876, -72.710686],
  VA: [37.769337, -78.169968],
  WA: [47.400902, -121.490494],
  WV: [38.491226, -80.954453],
  WI: [44.268543, -89.616508],
  WY: [42.755966, -107.30249],
};

/**
 * oyezSlug → https://www.oyez.org/justices/{oyezSlug}
 * mapState: pin placement (birth state from Court biographies; Roberts uses IN for
 * childhood home to reduce NY clustering with Sotomayor/Kagan).
 */
/** Official portraits via Wikimedia Commons (same images as English Wikipedia). */
const ROSTER = [
  {
    idSlug: "john-g-roberts-jr",
    oyezSlug: "john_g_roberts_jr",
    name: "John G. Roberts, Jr.",
    title: "Chief Justice of the United States",
    mapState: "IN",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Official_roberts_CJ.jpg/200px-Official_roberts_CJ.jpg",
  },
  {
    idSlug: "clarence-thomas",
    oyezSlug: "clarence_thomas",
    name: "Clarence Thomas",
    title: "Associate Justice",
    mapState: "GA",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Clarence_Thomas_official_SCOTUS_portrait_%283x4_cropped%29.jpg/200px-Clarence_Thomas_official_SCOTUS_portrait_%283x4_cropped%29.jpg",
  },
  {
    idSlug: "samuel-a-alito-jr",
    oyezSlug: "samuel_alito",
    name: "Samuel A. Alito, Jr.",
    title: "Associate Justice",
    mapState: "NJ",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Samuel_Alito_official_photo.jpg/200px-Samuel_Alito_official_photo.jpg",
  },
  {
    idSlug: "sonia-sotomayor",
    oyezSlug: "sonia_sotomayor",
    name: "Sonia Sotomayor",
    title: "Associate Justice",
    mapState: "NY",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Sonia_Sotomayor_in_SCOTUS_robe.jpg/200px-Sonia_Sotomayor_in_SCOTUS_robe.jpg",
  },
  {
    idSlug: "elena-kagan",
    oyezSlug: "elena_kagan",
    name: "Elena Kagan",
    title: "Associate Justice",
    mapState: "NY",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Elena_Kagan_Official_SCOTUS_Portrait_%282013%29.jpg/200px-Elena_Kagan_Official_SCOTUS_Portrait_%282013%29.jpg",
  },
  {
    idSlug: "neil-m-gorsuch",
    oyezSlug: "neil_gorsuch",
    name: "Neil M. Gorsuch",
    title: "Associate Justice",
    mapState: "CO",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Associate_Justice_Neil_Gorsuch_Official_Portrait.jpg/200px-Associate_Justice_Neil_Gorsuch_Official_Portrait.jpg",
  },
  {
    idSlug: "brett-m-kavanaugh",
    oyezSlug: "brett_m_kavanaugh",
    name: "Brett M. Kavanaugh",
    title: "Associate Justice",
    mapState: "DC",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Associate_Justice_Brett_Kavanaugh_Official_Portrait_%28full_length%29.jpg/200px-Associate_Justice_Brett_Kavanaugh_Official_Portrait_%28full_length%29.jpg",
  },
  {
    idSlug: "amy-coney-barrett",
    oyezSlug: "amy_coney_barrett",
    name: "Amy Coney Barrett",
    title: "Associate Justice",
    mapState: "LA",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Official_Amy_Barrett_photo.jpg/200px-Official_Amy_Barrett_photo.jpg",
  },
  {
    idSlug: "ketanji-brown-jackson",
    oyezSlug: "ketanji_brown_jackson",
    name: "Ketanji Brown Jackson",
    title: "Associate Justice",
    mapState: "DC",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Ketanji_Brown_Jackson_official_SCOTUS_portrait.jpg/200px-Ketanji_Brown_Jackson_official_SCOTUS_portrait.jpg",
  },
];

function offsetLatLng(baseLat, baseLng, index, total) {
  if (total <= 1) return { lat: baseLat, lng: baseLng };
  const angle = (index / total) * 2 * Math.PI;
  /** ~8–12 km — keeps multi-pin states (e.g. DC, NY) inside the same metro area */
  const rLat = 0.09;
  const rLng = 0.11;
  return {
    lat: baseLat + rLat * Math.sin(angle),
    lng: baseLng + rLng * Math.cos(angle),
  };
}

function main() {
  const byState = new Map();
  for (const j of ROSTER) {
    if (!byState.has(j.mapState)) byState.set(j.mapState, []);
    byState.get(j.mapState).push(j);
  }

  const justices = [];
  for (const [, group] of byState) {
    group.sort((a, b) => a.name.localeCompare(b.name));
    const total = group.length;
    group.forEach((j, index) => {
      const base = STATE_CENTERS[j.mapState] ?? [39.8283, -98.5795];
      const { lat, lng } = offsetLatLng(base[0], base[1], index, total);
      justices.push({
        id: `jus-${j.idSlug}`,
        name: j.name,
        title: j.title,
        state: j.mapState,
        photoUrl: j.photoUrl,
        website: `https://www.oyez.org/justices/${j.oyezSlug}`,
        lat,
        lng,
      });
    });
  }

  justices.sort((a, b) => {
    const chief = (x) => (x.title.includes("Chief") ? 0 : 1);
    const c = chief(a) - chief(b);
    if (c !== 0) return c;
    return a.name.localeCompare(b.name);
  });

  const payload = {
    source: "https://www.supremecourt.gov/about/biographies.aspx (current members)",
    fetchedAt: new Date().toISOString(),
    count: justices.length,
    justices,
  };

  const dest = join(__dirname, "..", "client", "public", "data", "supreme-court.json");
  writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${justices.length} justices to ${dest}`);
}

main();
