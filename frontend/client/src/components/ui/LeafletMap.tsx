import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BreastCancerIncidenceChoropleth from "./BreastCancerIncidenceChoropleth";
import {
  MapContainer,
  GeoJSON,
  useMapEvent,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
} from "react-leaflet";
import L, {
  LatLngBounds,
  LatLngBoundsExpression,
  LatLngLiteral,
  Map as LeafletMapType,
} from "leaflet";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJSON as GeoJSONType,
  GeoJsonProperties,
} from "geojson";
import type { Topology } from "topojson-specification";
import { feature as topojsonFeature } from "topojson-client";
import { patchLeafletIcons } from "@/lib/leaflet-icons";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import type { TimelineDateRange } from "@/lib/timeline";
import { CENSUS_AGE_GROUPS } from "@/lib/census-age-groups";
import {
  getHealthChoroplethColors,
  getHealthLayerMeta,
  HEALTH_CHOROPLETH_COLORS_NEGATIVE,
  HEALTH_PLACES_SOURCE,
} from "@/lib/health-places";
import {
  SPLC_HATE_MAP_LABEL,
  SPLC_HATE_MAP_SOURCE_CREDIT,
} from "@/lib/splc-hate-map";
import InsetMap from "./InsetMap";
import * as turf from "@turf/turf";

// State markers with Homicide Data
import HomicideMarkers from "./HomicideMarkers";

// Oil spill incidents data
import OilSpillMarkers from "./OilSpillMarkers";
import OilDrillingMarkers from "./OilDrillingMarkers";
import MassShootingMarkers from "./MassShootingMarkers";
import HeartDiseaseMortalityMarkers from "./HeartDiseaseMortalityMarkers";
// Air quality data
import AirQualityMarkers from "./AirQualityMarkers";

// Noise pollution data
import NoisePollutionLayer from "./NoisePollutionLayer";

// Rural access to intercity transportation (BTS)
import RuralAccessChoropleth from "./RuralAccessChoropleth";

// NASA satellite layers (GIBS) – one component for every NASA layer
import NasaLayers from "./NasaLayers";

// Waste treatment/disposal sites data
import WasteTreatmentDisposalMarkers from "./WasteTreatmentDisposalMarkers";

// Police Killing Data
import PoliceKillings from "./PoliceKillings";
import PoliceShootings from "./PoliceShootings";

// State markers with arrest data
import ArrestMarkers from "./ArrestMarkers";
import MissingPersons from "./MissingPersons";
import ConsentAge from "./ConsentAge";

// GHG emissions facilities data
import GhgEmissionsMarkers from "./GhgEmissionsMarkers";

// Data centers
import DataCenterMarkers from "./DataCenterMarkers";
import EarthquakeMarkers from "./EarthquakeMarkers";
import StormEventsLayer from "./StormEventsLayer";
import TornadoPathsLayer from "./TornadoPathsLayer";
import DebrisFlowMarkers from "./DebrisFlowMarkers";
import LandslideMarkers from "./LandslideMarkers";
import NationalRiskIndexLayer from "./NationalRiskIndexLayer";
import WildfireMarkers from "./WildfireMarkers";
import VolcanoMarkers from "./VolcanoMarkers";
import TsunamiMarkers from "./TsunamiMarkers";
import DroughtLayer from "./DroughtLayer";
import SenatorMarkers from "./SenatorMarkers";
import GovernorMarkers from "./GovernorMarkers";
import GerrymanderingMarkers from "./GerrymanderingMarkers";
import PresidentMarker from "./PresidentMarker";
import CongressionalDistrictsLayer from "./CongressionalDistrictsLayer";
import HouseMarkers from "./HouseMarkers";
import SupremeCourtMarkers from "./SupremeCourtMarkers";
import ElectoralCollegeStatesLayer from "./ElectoralCollegeStatesLayer";
import AlprCameraMarkers from "./AlprCameraMarkers";

/** Fixed bounds for the contiguous 48 states (CONUS) */
const CONUS_BOUNDS: LatLngBoundsExpression = [
  [24.5, -125.0], // SW
  [49.5, -66.9],  // NE
];

/** Clean focus boxes for AK/HI (avoid antimeridian weirdness) */
const AK_BOUNDS: LatLngBoundsExpression = [
  [54.0, -165.0], // SW
  [71.0, -130.0], // NE
];
const HI_BOUNDS: LatLngBoundsExpression = [
  [18.5, -161.0], // SW
  [22.75, -154.5], // NE
];


/** Compute bounds for any GeoJSON using Turf.js */
function boundsOf(geo: FeatureCollection | Feature<Geometry>): LatLngBounds {
  const bbox = turf.bbox(geo as any);
  // Turf bbox format: [minX, minY, maxX, maxY]
  // Leaflet bounds format: [[south, west], [north, east]]
  return L.latLngBounds(
    [bbox[1], bbox[0]], // SW corner [lat, lng]
    [bbox[3], bbox[2]]  // NE corner [lat, lng]
  );
}


/** detect AK/HI regardless of property naming */
function isState(
  f: Feature<Geometry, GeoJsonProperties>,
  target: "Alaska" | "Hawaii"
): boolean {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const name = String(p.name ?? p.NAME ?? p.State ?? p.state ?? p.admin ?? "").toLowerCase();
  const stusps = String(p.STUSPS ?? p.postal ?? p.code ?? "").toUpperCase();
  const fips = String(p.STATE ?? p.STATEFP ?? p.fips ?? p.FIPS ?? "");
  if (name.includes(target.toLowerCase())) return true;
  if (target === "Alaska" && (stusps === "AK" || fips === "02")) return true;
  if (target === "Hawaii" && (stusps === "HI" || fips === "15")) return true;
  return false;
}

/*This object is utilized by getStateCode function.  When a user clicks on a state
on the map, the function gets the state code so the backend route can fetch the
corresponding data for that state*/
const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA",
  Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

/** Get 2-letter state code from a state feature using properties.name. */
function getStateCode(f: Feature<Geometry, GeoJsonProperties>): string | null {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const name = String(p.name ?? p.NAME ?? p.State ?? p.state ?? "").trim();
  return name ? (STATE_NAME_TO_CODE[name] ?? null) : null;
}

function ClearFocusOnClick({
  onClear,
  suppressRef,
  disabled = false,
}: {
  onClear: () => void;
  suppressRef: React.MutableRefObject<boolean>;
  disabled?: boolean;
}) {
  useMapEvent("click", () => {
    if (disabled) return;
    if (suppressRef.current) return; // ignore clicks we initiated
    onClear();
  });
  return null;
}

const PIN_ICON = L.icon({
  iconUrl: "/figmaAssets/map-pin.png",
  /** Slightly narrower than square so the pin reads slimmer (matches toolbar icon). */
  iconSize: [26, 34],
  iconAnchor: [13, 31],
  popupAnchor: [0, -28],
  className: "drop-shadow-[0_6px_18px_rgba(6,16,35,0.45)]",
});

export type ChoroplethMetricKey =
  | "pct_white"
  | "pct_hispanic"
  | "pct_black"
  | "pct_asian"
  | "pct_east_asian"
  | "pct_arab"
  | "pct_male"
  | "pct_female"
  | "median_age";

export const CHOROPLETH_METRICS: Record<
  ChoroplethMetricKey,
  { label: string; unit: "%" | "yrs" }
> = {
  pct_white: { label: "Percent White", unit: "%" },
  pct_hispanic: { label: "Percent Hispanic", unit: "%" },
  pct_black: { label: "Percent Black", unit: "%" },
  pct_asian: { label: "Percent Asian", unit: "%" },
  pct_east_asian: { label: "Percent East Asian", unit: "%" },
  pct_arab: { label: "Percent Arab", unit: "%" },
  pct_male: { label: "Percent Male", unit: "%" },
  pct_female: { label: "Percent Female", unit: "%" },
  median_age: { label: "Median Age", unit: "yrs" },
};

/** Map choropleth race metric to data-file prefix for race+age requests */
const RACE_METRIC_TO_DATA_PREFIX: Record<string, string> = {
  pct_white: "white",
  pct_black: "black",
  pct_hispanic: "hispanic",
  pct_asian: "asian",
  pct_east_asian: "eastAsian",
  pct_arab: "arab",
};

const CHOROPLETH_COLORS = [
  "#2b6cb0", // blue
  "#63b3ed",
  "#bee3f8",
  "#f7fafc", // center
  "#fed7aa",
  "#f6ad55",
  "#ed8936", // lighter orange
];

const INCOME_CHOROPLETH_COLORS = [
  "#93c5fd", // lowest: blue
  "#60a5fa",
  "#38bdf8",
  "#2dd4bf",
  "#34d399",
  "#22c55e",
  "#166534", // highest: green
];

const ACS_ECONOMIC_FIRST_YEAR = 2009;
const ACS_ECONOMIC_LATEST_YEAR = 2024;
const UNEMPLOYMENT_FIRST_YEAR = 1990;

/** Approximate US national totals (2020 Census) for choropleth summary popup */
const US_TOTAL_POPULATION = 331_900_000;
const US_NATIONAL_CHOROPLETH_TOTALS: Partial<
  Record<
    ChoroplethMetricKey,
    { pct?: number; count?: number; medianAge?: number }
  >
> = {
  pct_white: { pct: 60.1, count: 199_500_000 },
  pct_black: { pct: 12.4, count: 41_200_000 },
  pct_hispanic: { pct: 18.7, count: 62_100_000 },
  pct_asian: { pct: 5.9, count: 19_600_000 },
  pct_east_asian: { pct: 2.9, count: 9_600_000 },
  pct_arab: { pct: 1.1, count: 3_700_000 },
  pct_male: { pct: 49.2, count: 163_300_000 },
  pct_female: { pct: 50.8, count: 168_600_000 },
  median_age: { medianAge: 38.4 },
};

function hashToUnit(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function mockMetricValue(geoid: string, metric: ChoroplethMetricKey) {
  const base = hashToUnit(`${metric}:${geoid}`);
  switch (metric) {
    case "pct_white":
      return 35 + base * 60; // 35–95
    case "pct_hispanic":
      return 4 + base * 65; // 4–69
    case "pct_black":
      return 2 + base * 50; // 2–52
    case "pct_asian":
    case "pct_east_asian":
    case "pct_arab":
    case "pct_male":
    case "pct_female":
      return base * 100;
    case "median_age":
      return 24 + base * 26; // 24–50 yrs
    default:
      return base * 100;
  }
}

function buildMockMetricByGeoId(
  geo: FeatureCollection<Geometry, GeoJsonProperties> | null,
  metric: ChoroplethMetricKey
) {
  const values: Record<string, number> = {};
  if (!geo) return values;
  for (const feature of geo.features) {
    const geoid = String(feature.properties?.GEOID ?? "");
    if (!geoid) continue;
    values[geoid] = mockMetricValue(geoid, metric);
  }
  return values;
}

function isFeatureCollection(
  geo: GeoJSONType
): geo is FeatureCollection<Geometry, GeoJsonProperties> {
  return geo.type === "FeatureCollection";
}

/** Check if a point is inside a geometry using Turf.js */
function geometryContainsPoint(
  geometry: Geometry | null | undefined,
  point: [number, number]
): boolean {
  if (!geometry) return false;

  // Turf expects [lng, lat] format for points
  const turfPoint = turf.point([point[0], point[1]]);

  try {
    // Convert geometry to Turf feature
    const feature = turf.feature(geometry);

    // Use Turf's booleanPointInPolygon for accurate point-in-polygon testing
    // Cast to any to handle all geometry types (Turf handles this internally)
    return turf.booleanPointInPolygon(turfPoint, feature as any, {
      ignoreBoundary: false, // Include points on boundary
    });
  } catch (error) {
    console.warn("Turf geometry check failed:", error);
    return false;
  }
}

function PinDropListener({
  enabled,
  onDrop,
  suppressRef,
}: {
  enabled: boolean;
  onDrop: (coords: LatLngLiteral) => void;
  suppressRef: React.MutableRefObject<boolean>;
}) {
  useMapEvent("click", (event) => {
    if (!enabled) return;
    suppressRef.current = true;
    onDrop(event.latlng);
    setTimeout(() => {
      suppressRef.current = false;
    }, 0);
  });
  return null;
}

type MapPin = {
  id: string;
  lat: number;
  lng: number;
  stateName?: string;
};

/** Red/blue House districts overlay: both parties, one party, or full split view */
export type HouseDistrictPartyMode = "both" | "red" | "blue";

export default function LeafletMap({
  loading = false,
  setLoading,
  sidebarOffsetPx = 0,
  hideInsets = false,
  pinDropMode = false,
  pins = [],
  onPinDrop,
  onPinRemove,
  choroplethMetric = "pct_white",
  showChoropleth = true,

  showPoliceKillingData = false,
  showPoliceShootings = false,

  showMurderData = false,
  murderCategory = "victim",
  murderAttribute = "age",

  arrestCategory = "Arrestee Sex",
  showArrestData = false,

  showMissingPersonsData = false,

  showMassShootings = false,

  showConsentAgeData = false,
  showAlprCameras = false,
  alprFlockOnly = false,

  /*toggle environmental information */
  showOilSpills = false,
  showOilDrillingLocations = false,
  showHeartDiseaseMortality = false,
  showAirQuality = false,
  showNoisePollution = false,
  showRuralAccess = false,
  showBreastCancerIncidence = false,
  ruralAccessYear = 2021,
  onRuralAccessYearChange,
  nasaLayerIds = [],
  nasaDate = null,
  onNasaDateChange,
  showGHGEmissions = false,
  showWasteTreatmentDisposal = false,
  showEarthquakes = false,
  earthquakeMinMagnitude = null,
  stormEventCategory = null,
  showTornadoes = false,
  showDebrisFlow = false,
  showLandslides = false,
  showVolcanoes = false,
  volcanoMinAlert = null,
  showTsunamis = false,
  showWildfires = false,
  wildfireMinAcres = null,
  showDrought = false,
  droughtCategory = null,
  showNationalRiskIndex = false,
  nationalRiskIndexHazard = null,
  showDataCenters = false,
  selectedAgeGroupId = null,
  selectedRaceCensusId = "all",
  selectedSexId = null,
  politicalLayerIds = [],
  houseDistrictPartyMode = "both",
  healthMetricId = null,
  showIncome = false,
  showHighIncomeHouseholds = false,
  showUnemployment = false,
  showPoverty = false,
  povertyYear = null,
  povertyAvailableYears = [],
  onPovertyDataMeta,
  showSplcHateMap = false,

  timelineRange = null,
  onDateRangeChange,
  timelineVisible = false,
}: {
  loading?: boolean;
  // Required: marker children call this unconditionally, and every code path
  // that raises the blocking LoadingBar must be able to lower it again.
  setLoading: (state: boolean) => void,
  sidebarOffsetPx?: number;
  hideInsets?: boolean;
  pinDropMode?: boolean;
  pins?: MapPin[];
  onPinDrop?: (coords: LatLngLiteral, stateName?: string) => void;
  onPinRemove?: (id: string) => void;
  choroplethMetric?: ChoroplethMetricKey;
  showChoropleth?: boolean;

  showPoliceKillingData?: boolean;
  showPoliceShootings?: boolean;

  showMurderData?: boolean;
  murderCategory?: string;
  murderAttribute?: string;

  arrestCategory?: string;
  showArrestData?: boolean;

  showMissingPersonsData?: boolean;

  /** Gun Violence Archive mass shootings, via The Trace's Data Hub */
  showMassShootings?: boolean;

  showNaturalDisasterIncidents?: boolean;
  naturalDisasterIncidentTypes?: string[];

  showConsentAgeData?: boolean;
  /** OpenStreetMap ALPR cameras, including Flock Safety */
  showAlprCameras?: boolean;
  alprFlockOnly?: boolean;
  showOilSpills?: boolean;
  showOilDrillingLocations?: boolean;
  showHeartDiseaseMortality?: boolean;
  showAirQuality?: boolean;
  showGHGEmissions?: boolean;
  showNoisePollution?: boolean;
  showRuralAccess?: boolean;
  showBreastCancerIncidence?: boolean;
  ruralAccessYear?: number;
  onRuralAccessYearChange?: (year: number) => void;
  /** Sidebar ids of the selected NASA satellite layers ("nasa:<id>") */
  nasaLayerIds?: string[];
  /** Picked NASA data date (YYYY-MM-DD); null shows the newest complete data */
  nasaDate?: string | null;
  onNasaDateChange?: (date: string | null) => void;

  showWasteTreatmentDisposal?: boolean;
  showEarthquakes?: boolean;
  earthquakeMinMagnitude?: number | null;
  stormEventCategory?: string | null;
  showTornadoes?: boolean;
  showDebrisFlow?: boolean;
  showLandslides?: boolean;
  showVolcanoes?: boolean;
  volcanoMinAlert?: string | null;
  showTsunamis?: boolean;
  showWildfires?: boolean;
  wildfireMinAcres?: number | null;
  showDrought?: boolean;
  droughtCategory?: number | null;
  showNationalRiskIndex?: boolean;
  /** NRI hazard code (e.g. "TRND"); null shows the composite risk rating */
  nationalRiskIndexHazard?: string | null;
  showDataCenters?: boolean;
  /** When set with a race metric, choropleth uses race+age data from /data/{race}_age_{id} */
  selectedAgeGroupId?: string | null;
  /** When "all", age selection uses age-only files (e.g. Age1-5); otherwise race+age */
  selectedRaceCensusId?: string;
  /** When set, choropleth shows male/female % (separate subcategory from race) */
  selectedSexId?: string | null;
  /** Sidebar Political checkboxes; e.g. includes "senators" for U.S. Senate pins */
  politicalLayerIds?: string[];
  houseDistrictPartyMode?: HouseDistrictPartyMode;
  /** CDC PLACES county health layer id from sidebar */
  healthMetricId?: string | null;
  showIncome?: boolean;
  showHighIncomeHouseholds?: boolean;
  showUnemployment?: boolean;
  showPoverty?: boolean;
  povertyYear?: number | null;
  povertyAvailableYears?: number[];
  onPovertyDataMeta?: (latestYear: number, availableYears: number[]) => void;
  /** SPLC Hate Map-derived group counts by state GEOID (/data/splc/by-state-geoid.json) */
  showSplcHateMap?: boolean;

  timelineRange?: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
  timelineVisible?: boolean;
}) {
  const politicalDistrictsActive =
    politicalLayerIds.includes("red-blue-district") ||
    politicalLayerIds.includes("electoral-college") ||
    politicalLayerIds.includes("gerrymandering");
  const choroplethVisible =
    (showChoropleth ||
      Boolean(healthMetricId) ||
      showIncome ||
      showHighIncomeHouseholds ||
      showUnemployment ||
      showPoverty ||
      showSplcHateMap) &&
    !politicalDistrictsActive;

  const mapRef = useRef<LeafletMapType | null>(null);
  const choroplethLayerRef = useRef<L.GeoJSON | null>(null);
  const choroplethRendererRef = useRef<L.Renderer | null>(null);
  const choroplethLegendRef = useRef<L.Control | null>(null);
  const choroplethLegendElRef = useRef<HTMLDivElement | null>(null);
  const suppressClear = useRef(false);
  const hasInitialFit = useRef(false);
  const isDefaultView = useRef(true);

  const [statesFC, setStatesFC] =
    useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [choroplethGeo, setChoroplethGeo] =
    useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [pctWhiteByGeoid, setPctWhiteByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctBlackByGeoid, setPctBlackByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctHispanicByGeoid, setPctHispanicByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctAsianByGeoid, setPctAsianByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctEastAsianByGeoid, setPctEastAsianByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctArabByGeoid, setPctArabByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctMaleByGeoid, setPctMaleByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [pctFemaleByGeoid, setPctFemaleByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [raceAgeValueByGeoid, setRaceAgeValueByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [healthValueByGeoid, setHealthValueByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [incomeValueByGeoid, setIncomeValueByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [incomeDataYear, setIncomeDataYear] = useState<number | null>(null);
  const [highIncomeHouseholdValueByGeoid, setHighIncomeHouseholdValueByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [highIncomeDataYear, setHighIncomeDataYear] = useState<number | null>(null);
  const [unemploymentValueByGeoid, setUnemploymentValueByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [povertyValueByGeoid, setPovertyValueByGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [povertyDataYear, setPovertyDataYear] = useState<number | null>(null);
  const [unemploymentPeriod, setUnemploymentPeriod] = useState<string | null>(null);
  const [splcByStateGeoid, setSplcByStateGeoid] = useState<
    Record<string, number> | null
  >(null);
  const [mapReady, setMapReady] = useState(false);
  const setMapInstanceRef = useCallback((map: LeafletMapType | null) => {
    mapRef.current = map;
    setMapReady(Boolean(map));
  }, []);

  /** 2-letter state code of the state the user clicked */
  const [clickedStateCode, setClickedStateCode] = useState<string | null>(null);

  /** Track current zoom */
  const [zoom, setZoom] = useState<number | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);
  const markerTimelineRange =
    showIncome || showHighIncomeHouseholds || showUnemployment || showPoverty
    ? null
    : timelineRange;

  // Bradyn, again this line is breaking my pins
  // Please let me know if it is required but I will comment
  // it out for now -Ethan
  // useEffect(() => patchLeafletIcons(), []);

  /** Load all states once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/geo/us-states.geojson");
        if (!res.ok) throw new Error("Could not load /geo/us-states.geojson");
        const json = (await res.json()) as FeatureCollection<Geometry, GeoJsonProperties>;
        if (!cancelled) setStatesFC(json);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load pctWhite data (GEOID -> pctWhite) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_White");
        if (!res.ok) return;
        const json = (await res.json()) as Record<
          string,
          { pctWhite?: number }
        >;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctWhite === "number") {
            cleaned[String(geoid)] = row.pctWhite;
          }
        }
        setPctWhiteByGeoid(cleaned);
      } catch (e) {
        console.error("pctWhite data load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load pctBlack data (GEOID -> pctBlack) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_Black");
        if (!res.ok) return;
        const json = (await res.json()) as Record<
          string,
          { pctBlack?: number }
        >;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctBlack === "number") {
            cleaned[String(geoid)] = row.pctBlack;
          }
        }
        setPctBlackByGeoid(cleaned);
      } catch (e) {
        console.error("pctBlack data load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load pctHispanic data (GEOID -> pctHispanic) */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_Hispanic");
        if (!res.ok) return;
        const json = (await res.json()) as Record<
          string,
          { pctHispanic?: number }
        >;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctHispanic === "number") {
            cleaned[String(geoid)] = row.pctHispanic;
          }
        }
        setPctHispanicByGeoid(cleaned);
      } catch (e) {
        console.error("pctHispanic data load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Load pctAsian data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_Asian");
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, { pctAsian?: number }>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctAsian === "number") {
            cleaned[String(geoid)] = row.pctAsian;
          }
        }
        setPctAsianByGeoid(cleaned);
      } catch (e) {
        console.error("pctAsian data load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Load pctEastAsian data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_EastAsian");
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, { pctEastAsian?: number }>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctEastAsian === "number") {
            cleaned[String(geoid)] = row.pctEastAsian;
          }
        }
        setPctEastAsianByGeoid(cleaned);
      } catch (e) {
        console.error("pctEastAsian data load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Load pctArab data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_Arab");
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, { pctArab?: number }>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctArab === "number") {
            cleaned[String(geoid)] = row.pctArab;
          }
        }
        setPctArabByGeoid(cleaned);
      } catch (e) {
        console.error("pctArab data load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Load pctMale data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_Male");
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, { pctMale?: number }>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctMale === "number") {
            cleaned[String(geoid)] = row.pctMale;
          }
        }
        setPctMaleByGeoid(cleaned);
      } catch (e) {
        console.error("pctMale data load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Load pctFemale data */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/data/pct_Female");
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, { pctFemale?: number }>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row && typeof row.pctFemale === "number") {
            cleaned[String(geoid)] = row.pctFemale;
          }
        }
        setPctFemaleByGeoid(cleaned);
      } catch (e) {
        console.error("pctFemale data load failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /** Load race+age or age-only data (GEOID -> value). Age-only when race is "All". */
  const raceDataPrefix =
    selectedRaceCensusId !== "all"
      ? RACE_METRIC_TO_DATA_PREFIX[choroplethMetric]
      : undefined;
  /** Age-only file names (total population that age): id -> /data filename without path */
  const AGE_ONLY_FILES: Record<string, string> = {
    "1_5": "Age1-5",
    "6_10": "Age6-10",
    "11_14": "Age11-14",
    "15_19": "Age15-19",
    "20_35": "Age20-35",
    "36_45": "Age36-45",
    "46_55": "Age46-55",
    "56_65": "Age56-65",
    "66_75": "Age66-75",
    "76_85": "Age76-85",
    "96_105": "Age96-105",
    "105_plus": "Age105+",
  };
  useEffect(() => {
    if (!selectedAgeGroupId) {
      setRaceAgeValueByGeoid(null);
      return;
    }
    let cancelled = false;
    /** Extract numeric value from a row; supports value, pctKids1_5, or other pct* keys */
    const valueFromRow = (row: number | Record<string, unknown>): number | undefined => {
      if (typeof row === "number" && !Number.isNaN(row)) return row;
      if (!row || typeof row !== "object") return undefined;
      const r = row as Record<string, unknown>;
      if (typeof r.value === "number") return r.value;
      if (typeof (r as { pctKids1_5?: number }).pctKids1_5 === "number") return (r as { pctKids1_5: number }).pctKids1_5;
      const pctKey = Object.keys(r).find((k) => k.startsWith("pct") && typeof r[k] === "number");
      return pctKey != null ? (r[pctKey] as number) : undefined;
    };
    const tryFetch = async (url: string): Promise<Response> => fetch(url);
    (async () => {
      try {
        let res: Response | null = null;
        if (raceDataPrefix) {
          res = await tryFetch(`/data/${raceDataPrefix}_age_${selectedAgeGroupId}`);
        }
        if (!res?.ok) {
          const ageOnlyFile = AGE_ONLY_FILES[selectedAgeGroupId] ?? `Age${selectedAgeGroupId.replace("_", "-")}`;
          res = await tryFetch(`/data/${ageOnlyFile}`);
        }
        if (!res?.ok) {
          if (cancelled) return;
          setRaceAgeValueByGeoid(null);
          return;
        }
        const json = (await res.json()) as Record<string, number | Record<string, unknown>>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, row] of Object.entries(json)) {
          if (row == null) continue;
          const num = valueFromRow(row);
          if (num !== undefined && !Number.isNaN(num)) {
            cleaned[String(geoid)] = num;
          }
        }
        setRaceAgeValueByGeoid(cleaned);
      } catch (e) {
        if (!cancelled) setRaceAgeValueByGeoid(null);
        console.error("Race+age / age-only data load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [choroplethMetric, selectedAgeGroupId, raceDataPrefix]);

  /** CDC PLACES county values for selected health metric */
  useEffect(() => {
    if (!healthMetricId) {
      setHealthValueByGeoid(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/data/health/${healthMetricId}.json`);
        if (!res.ok) {
          if (!cancelled) setHealthValueByGeoid(null);
          return;
        }
        const json = (await res.json()) as Record<string, number>;
        if (cancelled) return;
        const cleaned: Record<string, number> = {};
        for (const [geoid, v] of Object.entries(json)) {
          if (typeof v === "number" && !Number.isNaN(v)) {
            cleaned[String(geoid).padStart(5, "0")] = v;
          }
        }
        setHealthValueByGeoid(cleaned);
      } catch (e) {
        console.error("Health PLACES data load failed:", e);
        if (!cancelled) setHealthValueByGeoid(null);
      } finally {
        // Unconditional: the overlay blocks the whole app, so it must clear on
        // the !res.ok early return and on error, not just on success.
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [healthMetricId]);

  /** ACS median household income by county GEOID for the selected timeline year */
  useEffect(() => {
    if (!showIncome) {
      setIncomeValueByGeoid(null);
      setIncomeDataYear(null);
      onDateRangeChange("economics-income", null);
      return;
    }
    onDateRangeChange("economics-income", {
      start: Date.UTC(ACS_ECONOMIC_FIRST_YEAR, 0, 1),
      end: Date.UTC(ACS_ECONOMIC_LATEST_YEAR, 11, 31),
    });
    const timelineYear = timelineRange
      ? new Date(timelineRange.end).getUTCFullYear()
      : ACS_ECONOMIC_LATEST_YEAR;
    const year = Math.min(timelineYear, ACS_ECONOMIC_LATEST_YEAR);
    const timelineStartYear = timelineRange
      ? new Date(timelineRange.start).getUTCFullYear()
      : ACS_ECONOMIC_FIRST_YEAR;
    if (year < ACS_ECONOMIC_FIRST_YEAR || timelineStartYear > year) {
      setIncomeValueByGeoid(null);
      setIncomeDataYear(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    cachedApiGet<{
      year: number;
      counties: Array<{ geoid: string; medianHouseholdIncome: number }>;
    }>(
      `economics:incomeByCounty:${year}`,
      `/api/v1/economics/incomeByCounty?year=${year}`,
      CACHE_TTL.ECONOMICS
    )
      .then((response) => {
        if (cancelled) return;
        const values: Record<string, number> = {};
        for (const county of response.counties ?? []) {
          if (Number.isFinite(county.medianHouseholdIncome)) {
            values[String(county.geoid).padStart(5, "0")] = county.medianHouseholdIncome;
          }
        }
        setIncomeValueByGeoid(values);
        setIncomeDataYear(response.year);
      })
      .catch((error) => {
        console.error("County income data load failed:", error);
        if (!cancelled) {
          setIncomeValueByGeoid(null);
          setIncomeDataYear(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [showIncome, timelineRange, onDateRangeChange]);

  /** ACS share of households earning $200,000 or more for the selected year */
  useEffect(() => {
    if (!showHighIncomeHouseholds) {
      setHighIncomeHouseholdValueByGeoid(null);
      setHighIncomeDataYear(null);
      onDateRangeChange("economics-high-income", null);
      return;
    }
    onDateRangeChange("economics-high-income", {
      start: Date.UTC(ACS_ECONOMIC_FIRST_YEAR, 0, 1),
      end: Date.UTC(ACS_ECONOMIC_LATEST_YEAR, 11, 31),
    });
    const timelineYear = timelineRange
      ? new Date(timelineRange.end).getUTCFullYear()
      : ACS_ECONOMIC_LATEST_YEAR;
    const year = Math.min(timelineYear, ACS_ECONOMIC_LATEST_YEAR);
    const timelineStartYear = timelineRange
      ? new Date(timelineRange.start).getUTCFullYear()
      : ACS_ECONOMIC_FIRST_YEAR;
    if (year < ACS_ECONOMIC_FIRST_YEAR || timelineStartYear > year) {
      setHighIncomeHouseholdValueByGeoid(null);
      setHighIncomeDataYear(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    cachedApiGet<{
      year: number;
      counties: Array<{ geoid: string; highIncomeHouseholdPercent: number }>;
    }>(
      `economics:highIncomeHouseholdsByCounty:${year}`,
      `/api/v1/economics/highIncomeHouseholdsByCounty?year=${year}`,
      CACHE_TTL.ECONOMICS
    )
      .then((response) => {
        if (cancelled) return;
        const values: Record<string, number> = {};
        for (const county of response.counties ?? []) {
          if (Number.isFinite(county.highIncomeHouseholdPercent)) {
            values[String(county.geoid).padStart(5, "0")] = county.highIncomeHouseholdPercent;
          }
        }
        setHighIncomeHouseholdValueByGeoid(values);
        setHighIncomeDataYear(response.year);
      })
      .catch((error) => {
        console.error("County high-income household data load failed:", error);
        if (!cancelled) {
          setHighIncomeHouseholdValueByGeoid(null);
          setHighIncomeDataYear(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [showHighIncomeHouseholds, timelineRange, onDateRangeChange]);

  /** BLS Local Area Unemployment Statistics for the selected timeline month */
  useEffect(() => {
    if (!showUnemployment) {
      setUnemploymentValueByGeoid(null);
      setUnemploymentPeriod(null);
      onDateRangeChange("economics-unemployment", null);
      return;
    }
    const now = new Date();
    const latestMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    onDateRangeChange("economics-unemployment", {
      start: Date.UTC(UNEMPLOYMENT_FIRST_YEAR, 0, 1),
      end: latestMonth,
    });
    const selectedDate = new Date(
      Math.min(timelineRange?.end ?? now.getTime(), now.getTime()),
    );
    const selectedYear = selectedDate.getUTCFullYear();
    if (selectedYear != null && selectedYear < UNEMPLOYMENT_FIRST_YEAR) {
      setUnemploymentValueByGeoid(null);
      setUnemploymentPeriod(null);
      return;
    }
    const selectedMonth =
      `${selectedYear}-${String(selectedDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const query = `?start=${selectedYear}-01&end=${selectedMonth}`;

    let cancelled = false;
    setLoading(true);
    cachedApiGet<{
      year?: number;
      periodName?: string;
      counties?: Array<{ geoid: string; unemploymentRate: number }>;
      months?: Array<{
        year: number;
        period: string;
        periodName: string;
        counties: Array<{ geoid: string; unemploymentRate: number }>;
      }>;
    }>(
      `economics:unemploymentByCounty:${selectedMonth}`,
      `/api/v1/economics/unemploymentByCounty${query}`,
      CACHE_TTL.ECONOMICS
    )
      .then((response) => {
        if (cancelled) return;
        const availableMonths = response.months?.filter((month) => month.counties.length);
        const selectedPeriod = availableMonths?.[availableMonths.length - 1];
        if (selectedPeriod && timelineRange) {
          const rangeStart = new Date(timelineRange.start);
          const rangeStartMonth = rangeStart.getUTCFullYear() * 100
            + rangeStart.getUTCMonth() + 1;
          const monthNumber = Number(selectedPeriod.period.slice(1));
          if (selectedPeriod.year * 100 + monthNumber < rangeStartMonth) {
            setUnemploymentValueByGeoid(null);
            setUnemploymentPeriod(null);
            return;
          }
        }
        const counties = selectedPeriod?.counties ?? response.counties ?? [];
        if (!counties.length) {
          setUnemploymentValueByGeoid(null);
          setUnemploymentPeriod(null);
          return;
        }
        const values: Record<string, number> = {};
        for (const county of counties) {
          if (Number.isFinite(county.unemploymentRate)) {
            values[String(county.geoid).padStart(5, "0")] = county.unemploymentRate;
          }
        }
        setUnemploymentValueByGeoid(values);
        setUnemploymentPeriod(
          selectedPeriod
            ? `${selectedPeriod.periodName} ${selectedPeriod.year}`
            : `${response.periodName} ${response.year}`,
        );
      })
      .catch((error) => {
        console.error("County unemployment data load failed:", error);
        if (!cancelled) {
          setUnemploymentValueByGeoid(null);
          setUnemploymentPeriod(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [showUnemployment, timelineRange, onDateRangeChange]);

  /** Latest available SAIPE poverty rate by county GEOID */
  useEffect(() => {
    if (!showPoverty) {
      setPovertyValueByGeoid(null);
      setPovertyDataYear(null);
      onDateRangeChange("economics-poverty", null);
      return;
    }
    if (povertyAvailableYears.length) {
      onDateRangeChange("economics-poverty", {
        start: Date.UTC(Math.min(...povertyAvailableYears), 0, 1),
        end: Date.UTC(Math.max(...povertyAvailableYears), 11, 31),
      });
    }
    const timelineYear = timelineRange
      ? new Date(timelineRange.end).getUTCFullYear()
      : null;
    const timelineStartYear = timelineRange
      ? new Date(timelineRange.start).getUTCFullYear()
      : null;
    const timelinePovertyYear = timelineYear == null
      ? null
      : povertyAvailableYears
        .filter((year) =>
          year <= timelineYear && (timelineStartYear == null || year >= timelineStartYear)
        )
        .sort((a, b) => b - a)[0] ?? null;
    const selectedPovertyYear = povertyYear ?? timelinePovertyYear;
    if (
      timelineYear != null
      && povertyAvailableYears.length > 0
      && selectedPovertyYear == null
    ) {
      setPovertyValueByGeoid(null);
      setPovertyDataYear(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const povertyPath = selectedPovertyYear == null
      ? "/api/v1/economics/povertyByCounty"
      : `/api/v1/economics/povertyByCounty?year=${selectedPovertyYear}`;
    cachedApiGet<{
      year: number;
      latestYear: number;
      availableYears: number[];
      counties: Array<{ geoid: string; povertyRate: number }>;
    }>(
      `economics:povertyByCounty:${selectedPovertyYear ?? "latest"}`,
      povertyPath,
      CACHE_TTL.ECONOMICS
    )
      .then((response) => {
        if (cancelled) return;
        const values: Record<string, number> = {};
        for (const county of response.counties ?? []) {
          if (Number.isFinite(county.povertyRate)) {
            values[String(county.geoid).padStart(5, "0")] = county.povertyRate;
          }
        }
        setPovertyValueByGeoid(values);
        setPovertyDataYear(response.year);
        onDateRangeChange("economics-poverty", {
          start: Date.UTC(Math.min(...response.availableYears), 0, 1),
          end: Date.UTC(Math.max(...response.availableYears), 11, 31),
        });
        onPovertyDataMeta?.(response.latestYear, response.availableYears);
      })
      .catch((error) => {
        console.error("County poverty data load failed:", error);
        if (!cancelled) {
          setPovertyValueByGeoid(null);
          setPovertyDataYear(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [
    showPoverty,
    povertyYear,
    povertyAvailableYears,
    timelineRange,
    onPovertyDataMeta,
    onDateRangeChange,
  ]);

  /** SPLC Hate Map: group totals by state GEOID */
  useEffect(() => {
    if (!showSplcHateMap) {
      setSplcByStateGeoid(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/data/splc/by-state-geoid.json");
        if (!res.ok) {
          if (!cancelled) setSplcByStateGeoid(null);
          return;
        }
        const json = (await res.json()) as {
          byStateGeoid?: Record<string, number>;
        };
        const raw = json.byStateGeoid ?? {};
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v === "number" && !Number.isNaN(v))
            cleaned[String(k).padStart(2, "0")] = v;
        }
        if (!cancelled) setSplcByStateGeoid(cleaned);
      } catch (e) {
        console.error("SPLC data load failed:", e);
        if (!cancelled) setSplcByStateGeoid(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSplcHateMap]);

  /** Load choropleth polygons (counties topojson -> GeoJSON) */
  useEffect(() => {
    let cancelled = false;
    const normalize = (
      fc: FeatureCollection<Geometry, GeoJsonProperties>
    ): FeatureCollection<Geometry, GeoJsonProperties> => ({
      type: "FeatureCollection",
      features: fc.features.map((feature, index) => {
        const props = { ...(feature.properties ?? {}) } as Record<string, unknown>;
        const geoid = String(
          props.GEOID ?? props.geoid ?? (feature as any).id ?? index
        ).padStart(5, "0");
        const name =
          String(
            props.NAME ??
              props.name ??
              props.State ??
              props.state ??
              props.COUNTY ??
              props.county ??
              `County ${geoid}`
          );
        return {
          ...feature,
          properties: {
            ...props,
            GEOID: geoid,
            NAME: name,
          },
        };
      }),
    });

    (async () => {
      try {
        const topoUrl = "/geo/counties-10m.json";
        const topoRes = await fetch(topoUrl);
        if (!topoRes.ok) {
          console.error("Could not load counties TopoJSON file.");
          return;
        }
        const topo = (await topoRes.json()) as Topology;
        const topoObjects = (topo as any).objects ?? {};
        const countiesObject = topoObjects.counties;
        if (!countiesObject) {
          console.error("TopoJSON missing counties object.");
          return;
        }
        const countiesGeo = topojsonFeature(topo, countiesObject) as GeoJSONType;
        if (!isFeatureCollection(countiesGeo)) {
          console.error("TopoJSON counties object is not a FeatureCollection.");
          return;
        }
        if (!cancelled)
          setChoroplethGeo(normalize(countiesGeo));
      } catch (e) {
        console.error("Choropleth GeoJSON load failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Split into contiguous 48 and find AK/HI for inset boxes */
  const { contig48, alaska, hawaii } = useMemo(() => {
    if (!statesFC)
      return { contig48: null, alaska: undefined, hawaii: undefined };

    const ak = statesFC.features.find((f) => isState(f, "Alaska"));
    const hi = statesFC.features.find((f) => isState(f, "Hawaii"));

    const contiguous = {
      type: "FeatureCollection",
      features: statesFC.features.filter(
        (f) => !(isState(f, "Alaska") || isState(f, "Hawaii"))
      ),
    } as FeatureCollection<Geometry, GeoJsonProperties>;

    return { contig48: contiguous, alaska: ak, hawaii: hi };
  }, [statesFC]);

  const statesNormalizedGeo = useMemo(() => {
    if (!statesFC?.features?.length) return null;
    return {
      type: "FeatureCollection" as const,
      features: statesFC.features.map((feature, index) => {
        const idRaw =
          (feature as { id?: unknown }).id ??
          (feature.properties as Record<string, unknown> | undefined)?.GEOID ??
          index;
        const geoid = String(idRaw).padStart(2, "0");
        const props = { ...(feature.properties ?? {}) } as Record<string, unknown>;
        const name = String(props.NAME ?? props.name ?? `State ${geoid}`);
        return {
          ...feature,
          properties: {
            ...props,
            GEOID: geoid,
            NAME: name,
          },
        };
      }),
    };
  }, [statesFC]);

  const choroplethFeatureCollection = useMemo(() => {
    if (showSplcHateMap) return statesNormalizedGeo;
    return choroplethGeo;
  }, [showSplcHateMap, statesNormalizedGeo, choroplethGeo]);

  const metricByGeoId = useMemo(() => {
    if (showSplcHateMap) {
      if (splcByStateGeoid && Object.keys(splcByStateGeoid).length > 0) {
        return splcByStateGeoid;
      }
      return {};
    }
    if (showHighIncomeHouseholds) return highIncomeHouseholdValueByGeoid ?? {};
    if (showUnemployment) return unemploymentValueByGeoid ?? {};
    if (showPoverty) return povertyValueByGeoid ?? {};
    if (showIncome) return incomeValueByGeoid ?? {};
    if (healthMetricId) {
      if (
        healthValueByGeoid &&
        Object.keys(healthValueByGeoid).length > 0
      ) {
        return healthValueByGeoid;
      }
      return {};
    }
    // When an age group is selected, use race+age or age-only data if loaded
    if (selectedAgeGroupId && raceAgeValueByGeoid && Object.keys(raceAgeValueByGeoid).length > 0) {
      return raceAgeValueByGeoid;
    }
    // When sex is selected, use male/female data
    if (selectedSexId === "male" && pctMaleByGeoid) return pctMaleByGeoid;
    if (selectedSexId === "female" && pctFemaleByGeoid) return pctFemaleByGeoid;
    if (choroplethMetric === "pct_white" && pctWhiteByGeoid) {
      return pctWhiteByGeoid;
    }
    if (choroplethMetric === "pct_black" && pctBlackByGeoid) {
      return pctBlackByGeoid;
    }
    if (choroplethMetric === "pct_hispanic" && pctHispanicByGeoid) {
      return pctHispanicByGeoid;
    }
    if (choroplethMetric === "pct_asian" && pctAsianByGeoid) return pctAsianByGeoid;
    if (choroplethMetric === "pct_east_asian" && pctEastAsianByGeoid) return pctEastAsianByGeoid;
    if (choroplethMetric === "pct_arab" && pctArabByGeoid) return pctArabByGeoid;
    // TODO: Replace buildMockMetricByGeoId with real API data mapped by GEOID.
    return buildMockMetricByGeoId(choroplethGeo, choroplethMetric);
  }, [
    choroplethGeo,
    choroplethMetric,
    pctWhiteByGeoid,
    pctBlackByGeoid,
    pctHispanicByGeoid,
    pctAsianByGeoid,
    pctEastAsianByGeoid,
    pctArabByGeoid,
    pctMaleByGeoid,
    pctFemaleByGeoid,
    selectedAgeGroupId,
    selectedSexId,
    raceDataPrefix,
    raceAgeValueByGeoid,
    healthMetricId,
    healthValueByGeoid,
    showUnemployment,
    unemploymentValueByGeoid,
    showPoverty,
    povertyValueByGeoid,
    showHighIncomeHouseholds,
    highIncomeHouseholdValueByGeoid,
    showIncome,
    incomeValueByGeoid,
    showSplcHateMap,
    splcByStateGeoid,
  ]);

  const choroplethValueByGeoid = useMemo(() => {
    return new Map(Object.entries(metricByGeoId));
  }, [metricByGeoId]);

  const activeChoroplethColors = useMemo(() => {
    if (showSplcHateMap) return [...HEALTH_CHOROPLETH_COLORS_NEGATIVE];
    if (healthMetricId) return getHealthChoroplethColors(healthMetricId);
    if (showIncome || showHighIncomeHouseholds) return INCOME_CHOROPLETH_COLORS;
    return CHOROPLETH_COLORS;
  }, [healthMetricId, showHighIncomeHouseholds, showIncome, showSplcHateMap]);

  const choroplethBreaks = useMemo(() => {
    const values = Array.from(choroplethValueByGeoid.values()).sort(
      (a, b) => a - b
    );
    if (!values.length) return [];
    const bins = activeChoroplethColors.length;
    const breaks: number[] = [];
    for (let i = 1; i <= bins; i++) {
      const idx = Math.min(values.length - 1, Math.floor((i / bins) * values.length) - 1);
      breaks.push(values[Math.max(0, idx)]);
    }
    return breaks;
  }, [choroplethValueByGeoid, activeChoroplethColors]);

  const getChoroplethColor = useCallback(
    (value: number) => {
      for (let i = 0; i < choroplethBreaks.length; i++) {
        if (value <= choroplethBreaks[i]) return activeChoroplethColors[i];
      }
      return activeChoroplethColors[activeChoroplethColors.length - 1];
    },
    [choroplethBreaks, activeChoroplethColors]
  );

  const formatMetricValue = useCallback(
    (value: number | undefined) => {
      if (value == null || Number.isNaN(value)) return "N/A";
      if (showSplcHateMap)
        return `${Math.round(value)} group${Math.round(value) === 1 ? "" : "s"}`;
      if (showHighIncomeHouseholds) return `${value.toFixed(1)}%`;
      if (showUnemployment) return `${value.toFixed(1)}%`;
      if (showPoverty) return `${value.toFixed(1)}%`;
      if (showIncome) return `$${Math.round(value).toLocaleString("en-US")}`;
      if (healthMetricId) return `${value.toFixed(1)}%`;
      const unit = CHOROPLETH_METRICS[choroplethMetric].unit;
      if (unit === "%") return `${value.toFixed(1)}%`;
      return `${value.toFixed(1)} yrs`;
    },
    [
      choroplethMetric,
      healthMetricId,
      showHighIncomeHouseholds,
      showIncome,
      showPoverty,
      showSplcHateMap,
      showUnemployment,
    ]
  );

  const choroplethStyle = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>) => {
      const geoid = String(feature?.properties?.GEOID ?? "");
      const value = choroplethValueByGeoid.get(geoid);
      return {
        fillColor: value == null ? "#e5e7eb" : getChoroplethColor(value),
        fillOpacity: 0.68,
        color: "#0a3b55",
        weight: 0.35,
        opacity: 0.45,
        renderer: choroplethRendererRef.current ?? undefined,
      } as L.PathOptions;
    },
    [choroplethValueByGeoid, getChoroplethColor]
  );

  const choroplethLegendItems = useMemo(() => {
    if (!choroplethBreaks.length) return [];
    const fmt = showSplcHateMap
      ? (n: number) => String(Math.round(n))
      : showHighIncomeHouseholds || showUnemployment || showPoverty
        ? (n: number) => n.toFixed(1)
        : showIncome
          ? (n: number) => `$${Math.round(n).toLocaleString("en-US")}`
          : (n: number) => n.toFixed(1);
    const items: Array<{ color: string; label: string }> = [];
    for (let i = 0; i < choroplethBreaks.length; i++) {
      const lower = i === 0 ? 0 : choroplethBreaks[i - 1];
      const upper = choroplethBreaks[i];
      const label =
        i === 0
          ? `≤ ${fmt(upper)}`
          : `${fmt(lower)}–${fmt(upper)}`;
      items.push({ color: activeChoroplethColors[i], label });
    }
    return items;
  }, [
    choroplethBreaks,
    activeChoroplethColors,
    showHighIncomeHouseholds,
    showIncome,
    showPoverty,
    showSplcHateMap,
    showUnemployment,
  ]);

  /** National-level summary for the current choropleth metric (for popup above legend) */
  const nationalSummary = useMemo(() => {
    if (showSplcHateMap) {
      const values = Array.from(choroplethValueByGeoid.values()).filter(
        (v) => typeof v === "number" && !Number.isNaN(v)
      );
      if (values.length === 0) return null;
      const total = values.reduce((a, b) => a + b, 0);
      return { splcTotal: total, isSplc: true as const };
    }
    if (showIncome || showHighIncomeHouseholds || showUnemployment || showPoverty) return null;
    if (healthMetricId) {
      const values = Array.from(choroplethValueByGeoid.values()).filter(
        (v) => typeof v === "number" && !Number.isNaN(v)
      );
      if (values.length === 0) return null;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return { pct: avg, isPercent: true, isHealth: true as const };
    }
    const metricKey: ChoroplethMetricKey =
      selectedSexId === "male"
        ? "pct_male"
        : selectedSexId === "female"
          ? "pct_female"
          : choroplethMetric;
    const known = US_NATIONAL_CHOROPLETH_TOTALS[metricKey];
    if (known) {
      if ("medianAge" in known && known.medianAge != null) {
        return { medianAge: known.medianAge, isPercent: false };
      }
      if (known.pct != null && known.count != null) {
        return { pct: known.pct, count: known.count, isPercent: true };
      }
    }
    // Age-only or race+age: use average of county values and estimate count
    const values = Array.from(choroplethValueByGeoid.values()).filter(
      (v) => typeof v === "number" && !Number.isNaN(v)
    );
    if (values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const count = Math.round((avg / 100) * US_TOTAL_POPULATION);
    return { pct: avg, count, isPercent: true };
  }, [
    choroplethMetric,
    selectedSexId,
    choroplethValueByGeoid,
    healthMetricId,
    showIncome,
    showPoverty,
    showUnemployment,
    showSplcHateMap,
  ]);

  /** Track when the user moves/zooms away from the default launch view */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const markNotDefault = () => {
      isDefaultView.current = false;
    };
    const events: Array<"zoomstart" | "dragstart" | "movestart"> = [
      "zoomstart",
      "dragstart",
      "movestart",
    ];
    events.forEach((eventName) => map.on(eventName, markNotDefault));
    return () => {
      events.forEach((eventName) => map.off(eventName, markNotDefault));
    };
  }, [mapReady]);

  /** When the sidebar width changes, re-fit the default view to keep CONUS centered */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hasInitialFit.current) return;
    if (!isDefaultView.current) return;

    requestAnimationFrame(() => {
      map.fitBounds(CONUS_BOUNDS, {
        paddingTopLeft: [sidebarOffsetPx + 12, 24],
        paddingBottomRight: [24, 24],
        animate: true,
      });
    });
  }, [sidebarOffsetPx]);

  /** First frame: fit perfectly to the lower-48 (account for the sidebar) — run ONCE */
  useEffect(() => {
    if (!mapRef.current || hasInitialFit.current) return;
    hasInitialFit.current = true;

    const b = CONUS_BOUNDS;
    requestAnimationFrame(() => {
      mapRef.current!.fitBounds(b, {
        paddingTopLeft: [sidebarOffsetPx + 12, 24],
        paddingBottomRight: [24, 24],
      });
      setTimeout(() => {
        if (!mapRef.current) return;
        // Ensure Leaflet knows its size, then re-fit to perfectly fill viewport
        mapRef.current.invalidateSize();
        // Re-fit after size invalidation to guarantee desired framing
        mapRef.current.fitBounds(CONUS_BOUNDS, {
          paddingTopLeft: [sidebarOffsetPx + 12, 24],
          paddingBottomRight: [24, 24],
        });
      }, 50);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /** Blue overlay style for national view */
  const outlineStyle: L.PathOptions = {
    color: "#0a3b55",
    weight: 1,
    fillOpacity: 0,
    fill: false,
  };

  const updateChoroplethTooltip = useCallback(
    (layer: L.Layer) => {
      const feature = (layer as any).feature as Feature<
        Geometry,
        GeoJsonProperties
      > | null;
      if (!feature) return;
      const name = String(feature.properties?.NAME ?? "Unknown");
      const geoid = String(feature.properties?.GEOID ?? "");
      const value = choroplethValueByGeoid.get(geoid);
      const isAgeOnly =
        selectedRaceCensusId === "all" && selectedAgeGroupId != null;
      const isSexView = selectedSexId != null;
      const metricLabel = showSplcHateMap
        ? SPLC_HATE_MAP_LABEL
        : showHighIncomeHouseholds
          ? `Households earning $200,000 or more (${highIncomeDataYear ?? "most recent"})`
          : showUnemployment
            ? `County Unemployment Rate${unemploymentPeriod ? ` (${unemploymentPeriod})` : ""}`
          : showPoverty
          ? `County Poverty Rate (${povertyYear ?? povertyDataYear ?? "most recent"})`
          : showIncome
          ? `Median Household Income (${incomeDataYear ?? "most recent"})`
          : healthMetricId
          ? getHealthLayerMeta(healthMetricId).label
          : isAgeOnly
            ? `Percent population aged ${
                CENSUS_AGE_GROUPS.find((a) => a.id === selectedAgeGroupId)?.label ??
                selectedAgeGroupId.replace("_", "–")
              }`
            : isSexView
              ? CHOROPLETH_METRICS[selectedSexId === "male" ? "pct_male" : "pct_female"].label
              : CHOROPLETH_METRICS[choroplethMetric].label;
      const tooltipHtml = `<div class="text-xs font-semibold">${name}</div><div class="text-xs">${metricLabel}: ${formatMetricValue(
        value
      )}</div>`;
      (layer as L.Path).bindTooltip(tooltipHtml, {
        sticky: true,
        direction: "top",
        opacity: 0.9,
      });
    },
    [
      choroplethMetric,
      choroplethValueByGeoid,
      formatMetricValue,
      selectedRaceCensusId,
      selectedAgeGroupId,
      selectedSexId,
      healthMetricId,
      showHighIncomeHouseholds,
      showIncome,
      incomeDataYear,
      highIncomeDataYear,
      showPoverty,
      povertyYear,
      povertyDataYear,
      showUnemployment,
      unemploymentPeriod,
      showSplcHateMap,
    ]
  );

  const applyChoroplethBaseStyle = useCallback(
    (
      layer: L.Layer,
      feature?: Feature<Geometry, GeoJsonProperties>
    ) => {
      (layer as L.Path).setStyle(choroplethStyle(feature));
    },
    [choroplethStyle]
  );

  const onEachChoroplethFeature = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => {
      updateChoroplethTooltip(layer);
      layer.on({
        mouseover: (e: L.LeafletMouseEvent) => {
          const target = e.target as L.Path;
          target.setStyle({
            weight: 1,
            color: "#1ea7ff",
            fillOpacity: 0.8,
          });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            target.bringToFront();
          }
        },
        mouseout: () => {
          applyChoroplethBaseStyle(layer, feature);
        },
      });
    },
    [applyChoroplethBaseStyle, updateChoroplethTooltip]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !choroplethFeatureCollection) return;

    if (!choroplethLayerRef.current) {
      let pane = map.getPane("choroplethPane");
      if (!pane) {
        pane = map.createPane("choroplethPane");
        pane.style.zIndex = "350";
      }
      const renderer = choroplethRendererRef.current ?? L.canvas({
        pane: "choroplethPane",
      });
      choroplethRendererRef.current = renderer;
      choroplethLayerRef.current = L.geoJSON(choroplethFeatureCollection, {
        pane: "choroplethPane",
        style: choroplethStyle,
        onEachFeature: onEachChoroplethFeature,
      });
    } else {
      choroplethLayerRef.current.options.style = choroplethStyle;
      choroplethLayerRef.current.options.onEachFeature = onEachChoroplethFeature;
      choroplethLayerRef.current.clearLayers();
      choroplethLayerRef.current.addData(choroplethFeatureCollection as any);
    }

    if (choroplethVisible) {
      if (!map.hasLayer(choroplethLayerRef.current)) {
        choroplethLayerRef.current.addTo(map);
      }
    } else if (map.hasLayer(choroplethLayerRef.current)) {
      choroplethLayerRef.current.remove();
    }
  }, [
    mapReady,
    choroplethFeatureCollection,
    choroplethVisible,
    choroplethStyle,
    onEachChoroplethFeature,
  ]);

  useEffect(() => {
    if (!choroplethLayerRef.current) return;
    choroplethLayerRef.current.setStyle(choroplethStyle);
    choroplethLayerRef.current.eachLayer((layer) => updateChoroplethTooltip(layer));
  }, [choroplethStyle, updateChoroplethTooltip]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!choroplethLegendRef.current) {
      const control = (L as any).control({ position: "bottomright" }) as L.Control;
      control.onAdd = () => {
        const div = L.DomUtil.create(
          "div",
          "rounded-lg border border-white/10 bg-[#0c1022]/70 backdrop-blur px-3 py-2 text-xs text-white/90 shadow-lg"
        );
        choroplethLegendElRef.current = div;
        return div;
      };
      control.addTo(map);
      choroplethLegendRef.current = control;
    }
  }, [mapReady]);

  useEffect(() => {
    const el = choroplethLegendElRef.current;
    if (!el) return;
    if (
      !choroplethVisible ||
      !choroplethLegendItems.length ||
      showBreastCancerIncidence
    ) {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    const isAgeOnly =
      selectedRaceCensusId === "all" && selectedAgeGroupId != null;
    const isSexView = selectedSexId != null;
    const metricLabel = showSplcHateMap
      ? SPLC_HATE_MAP_LABEL
      : showHighIncomeHouseholds
        ? `Households earning $200,000 or more (${highIncomeDataYear ?? "most recent"})`
        : showUnemployment
          ? `County Unemployment Rate${unemploymentPeriod ? ` (${unemploymentPeriod})` : ""}`
        : showPoverty
        ? `County Poverty Rate (${povertyYear ?? povertyDataYear ?? "most recent"})`
        : showIncome
        ? `Median Household Income (${incomeDataYear ?? "most recent"})`
        : healthMetricId
        ? getHealthLayerMeta(healthMetricId).label
        : isAgeOnly
          ? `Percent population aged ${
              CENSUS_AGE_GROUPS.find((a) => a.id === selectedAgeGroupId)?.label ??
              selectedAgeGroupId.replace("_", "–")
            }`
          : isSexView
            ? CHOROPLETH_METRICS[selectedSexId === "male" ? "pct_male" : "pct_female"].label
            : CHOROPLETH_METRICS[choroplethMetric].label;
    const unit = showSplcHateMap
      ? ""
      : showUnemployment || showHighIncomeHouseholds || showPoverty
        ? "%"
      : showIncome
        ? ""
      : healthMetricId
        ? "%"
        : isSexView
          ? "%"
          : CHOROPLETH_METRICS[choroplethMetric].unit;
    const barStops = activeChoroplethColors
      .map(
        (color, index) =>
          `${color} ${(index / (activeChoroplethColors.length - 1)) * 100}%`
      )
      .join(", ");
    const tickLabels = choroplethLegendItems
      .map(
        (item) =>
          `<span style="font-size:10px;white-space:nowrap;">${item.label}${
            unit === "%" ? "%" : ""
          }</span>`
      )
      .join("");
    const formatRangeBound = (value: number) => {
      if (showSplcHateMap) return String(Math.round(value));
      if (showHighIncomeHouseholds || showUnemployment || showPoverty) {
        return `${value.toFixed(1)}%`;
      }
      if (showIncome) return `$${Math.round(value).toLocaleString("en-US")}`;
      return `${value.toFixed(1)}${unit === "%" ? "%" : ""}`;
    };
    const rangeBounds = choroplethBreaks.length
      ? `<div style="display:flex;justify-content:space-between;gap:6px;margin-top:3px;font-size:10px;opacity:0.75;">
          <span>Min ${formatRangeBound(choroplethBreaks[0])}</span>
          <span>Max ${formatRangeBound(choroplethBreaks[choroplethBreaks.length - 1])}</span>
        </div>`
      : "";

    const nationalPopupHtml =
      nationalSummary == null
        ? ""
        : "isSplc" in nationalSummary && nationalSummary.isSplc && nationalSummary.splcTotal != null
          ? `<div class="rounded border border-white/20 bg-black/40 px-2.5 py-1.5 mb-2 text-[10px] leading-tight" style="margin-bottom:8px;">
               <div style="font-weight:600;opacity:0.95;">Total group listings (all states): ${nationalSummary.splcTotal}</div>
               <div style="opacity:0.75;">${SPLC_HATE_MAP_SOURCE_CREDIT}</div>
             </div>`
        : "isHealth" in nationalSummary && nationalSummary.isHealth && nationalSummary.pct != null
          ? `<div class="rounded border border-white/20 bg-black/40 px-2.5 py-1.5 mb-2 text-[10px] leading-tight" style="margin-bottom:8px;">
               <div style="font-weight:600;opacity:0.95;">Mean of county estimates: ${nationalSummary.pct.toFixed(1)}%</div>
               <div style="opacity:0.75;">${HEALTH_PLACES_SOURCE}</div>
             </div>`
        : nationalSummary.isPercent && nationalSummary.pct != null && nationalSummary.count != null
          ? `<div class="rounded border border-white/20 bg-black/40 px-2.5 py-1.5 mb-2 text-[10px] leading-tight" style="margin-bottom:8px;">
               <div style="font-weight:600;opacity:0.95;">${nationalSummary.pct.toFixed(1)}% of US population</div>
               <div style="opacity:0.85;">${(nationalSummary.count / 1_000_000).toFixed(1)} million people</div>
             </div>`
          : !nationalSummary.isPercent && "medianAge" in nationalSummary && nationalSummary.medianAge != null
            ? `<div class="rounded border border-white/20 bg-black/40 px-2.5 py-1.5 mb-2 text-[10px] leading-tight" style="margin-bottom:8px;">
                 <div style="font-weight:600;opacity:0.95;">US median age: ${nationalSummary.medianAge.toFixed(1)} yrs</div>
               </div>`
            : "";

    el.innerHTML = `
      ${nationalPopupHtml}
      <div style="font-weight:600;font-size:11px;margin-bottom:4px;opacity:0.9;">${
        showSplcHateMap
          ? "State aggregates (tabular import)"
          : showUnemployment
            ? "BLS Local Area Unemployment Statistics"
            : showPoverty
            ? "Census SAIPE county estimates"
            : showHighIncomeHouseholds
            ? "ACS 5-year estimates"
            : showIncome
            ? "County estimates"
            : healthMetricId
            ? "County model-based rate"
            : "Total population"
      }</div>
      <div style="font-weight:600;margin-bottom:6px;">${metricLabel}</div>
      <div style="height:8px;border-radius:6px;background:linear-gradient(90deg, ${barStops});"></div>
      <div style="display:flex;justify-content:space-between;gap:6px;margin-top:4px;">${tickLabels}</div>
      ${rangeBounds}
    `;
  }, [
    choroplethLegendItems,
    choroplethMetric,
    choroplethVisible,
    selectedRaceCensusId,
    selectedAgeGroupId,
    selectedSexId,
    nationalSummary,
    healthMetricId,
    showHighIncomeHouseholds,
    highIncomeDataYear,
    showIncome,
    incomeDataYear,
    showPoverty,
    povertyYear,
    povertyDataYear,
    showUnemployment,
    unemploymentPeriod,
    activeChoroplethColors,
    showSplcHateMap,
    showBreastCancerIncidence,
  ]);

  /** base map threshold for zoom/clickl */
  /** Focus helpers for insets */
  const focusAK = () => {
    const map = mapRef.current;
    if (!map || !alaska) return;

    suppressClear.current = true;
    requestAnimationFrame(() => {
      // Use same approach as Hawaii - same padding and bounds style
      map.flyToBounds(AK_BOUNDS, {
        paddingTopLeft: [12, 24],
        paddingBottomRight: [24, 24],
        duration: 0.6,
      });
      map.once("moveend", () => { suppressClear.current = false; });
    });
  };

  const focusHI = () => {
    const map = mapRef.current;
    if (!map || !hawaii) return;

    suppressClear.current = true;
    requestAnimationFrame(() => {
      map.flyToBounds(HI_BOUNDS, {
        paddingTopLeft: [12, 24],
        paddingBottomRight: [24, 24],
        duration: 0.6,
      });
      map.once("moveend", () => { suppressClear.current = false; });
    });
  };


  /** Zoom to a clicked state and switch to basemap (hide overlay) */
  const onEachState = (
    feature: Feature<Geometry, GeoJsonProperties>,
    layer: L.Layer
  ) => {
    layer.on("mouseover", () =>
      (layer as L.Path).setStyle({ weight: 2, color: "#0fb2ff" })
    );
    layer.on("mouseout", () =>
      (layer as L.Path).setStyle({ weight: 1, color: "#0a3b55" })
    );

      layer.on("click", (e: L.LeafletMouseEvent) => {
      if (pinDropMode) {
        return;
      }
      // stop bubbling to map click handler
      if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
      e.originalEvent?.stopPropagation?.();
      e.originalEvent?.preventDefault?.();

      suppressClear.current = true;
      setTimeout(() => (suppressClear.current = false), 0);

      const map = mapRef.current;
      if (!map) return;

      /* get state code for specified state and updates value of marker component*/
      const stateCode = getStateCode(feature);
      if (stateCode) {setClickedStateCode(stateCode)};

      // AK/HI use fixed bounds; others compute from coordinates
      if (isState(feature, "Alaska")) {
        map.flyToBounds(AK_BOUNDS, {
          paddingTopLeft: [sidebarOffsetPx + 12, 24],
          paddingBottomRight: [24, 24],
          duration: 0.6,
        });
        return;
      }
      if (isState(feature, "Hawaii")) {
        map.flyToBounds(HI_BOUNDS, {
          paddingTopLeft: [sidebarOffsetPx + 12, 24],
          paddingBottomRight: [24, 24],
          duration: 0.6,
        });
        return;
      }

      // Simple fit bounds to the feature
      const featureBounds = boundsOf(feature);
      map.flyToBounds(featureBounds, {
        paddingTopLeft: [sidebarOffsetPx + 12, 24],
        paddingBottomRight: [24, 24],
        duration: 0.6,
      });
    });
  };

  return (
    <div
      ref={mapSectionRef}
      className={`relative h-full w-full${timelineVisible ? " timeline-visible-map" : ""}`}
    >
      <MapContainer
        ref={setMapInstanceRef}
        className="h-full w-full"
        bounds={CONUS_BOUNDS}
        boundsOptions={{ paddingTopLeft: [sidebarOffsetPx + 12, 24], paddingBottomRight: [24, 24] }}
        minZoom={3}
        maxZoom={19}
        zoomControl={false}
        worldCopyJump={false}
        preferCanvas
        attributionControl={false}
      >
        <PinDropListener
          enabled={pinDropMode}
          onDrop={(coords) => {
            const point: [number, number] = [coords.lng, coords.lat];
            let stateLabel: string | undefined;
            if (statesFC) {
              for (const feature of statesFC.features) {
                if (geometryContainsPoint(feature.geometry, point)) {
                  const props = feature.properties ?? {};
                  const name =
                    (props.NAME as string) ??
                    (props.name as string) ??
                    (props.admin as string) ??
                    (props.State as string) ??
                    (props.state as string) ??
                    (props.postal as string) ??
                    undefined;
                  const abbrev = (props.STUSPS as string) ?? (props.postal as string);
                  stateLabel = name ? (abbrev ? `${name} (${abbrev})` : name) : abbrev;
                  break;
                }
              }
            }
            onPinDrop?.(coords, stateLabel);
          }}
          suppressRef={suppressClear}
        />

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          noWrap={false}
          maxZoom={19}
        />

        {politicalLayerIds.includes("electoral-college") && (
          <ElectoralCollegeStatesLayer />
        )}

        {/* Full U.S. House district mesh — under party overlay when both on */}
        {politicalLayerIds.includes("gerrymandering") && (
          <CongressionalDistrictsLayer mode="gerry-outline" />
        )}

        {politicalLayerIds.includes("red-blue-district") &&
          (houseDistrictPartyMode === "both" ? (
            <CongressionalDistrictsLayer mode="party-split" />
          ) : houseDistrictPartyMode === "red" ? (
            <CongressionalDistrictsLayer mode="red-district" />
          ) : (
            <CongressionalDistrictsLayer mode="blue-district" />
          ))}

        {contig48 && (
          <GeoJSON data={contig48 as any} style={outlineStyle} onEachFeature={onEachState} />
        )}

        {pins.map((pin) => (
          <Marker key={pin.id} position={{ lat: pin.lat, lng: pin.lng }} icon={PIN_ICON}>
            <Popup>
              <div className="text-sm font-semibold text-[#0c1022]">Pinned Location</div>
              {pin.stateName && (
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#0c1022]">
                  {pin.stateName}
                </div>
              )}
              <div className="mt-1 text-xs text-[#0c1022]/70">
                {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
              </div>
              {onPinRemove && (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center rounded-full bg-[#0c1022] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14295a]"
                  onClick={() => onPinRemove(pin.id)}
                >
                  Remove Pin
                </button>
              )}
            </Popup>
          </Marker>
        ))}

        {/* TESTING - State Markers with Homicide Data  */}
        <HomicideMarkers murderCategory={murderCategory} murderAttribute={murderAttribute} showMurderData={showMurderData}></HomicideMarkers>

        {/* Oil spill incidents – shown when Oil Spills is selected in sidebar */}
        {showOilSpills && (
          <OilSpillMarkers
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showOilDrillingLocations && (
          <OilDrillingMarkers setLoading={setLoading} />
        )}
        {showHeartDiseaseMortality && (
          <HeartDiseaseMortalityMarkers setLoading={setLoading} />
       )}

        {/* FEMA National Risk Index – county risk ratings, overall or for one hazard */}
        {showNationalRiskIndex && (
          <NationalRiskIndexLayer selectedHazard={nationalRiskIndexHazard} setLoading={setLoading} />
        )}

        {stormEventCategory && (
          <StormEventsLayer
            key={stormEventCategory}
            title={stormEventCategory}
            categories={[stormEventCategory]}
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showTornadoes && (
          <TornadoPathsLayer
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showDebrisFlow && (
          <DebrisFlowMarkers
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showLandslides && (
          <LandslideMarkers
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}

        {showEarthquakes && (
          <EarthquakeMarkers
            minMagnitude={earthquakeMinMagnitude}
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showVolcanoes && (
          <VolcanoMarkers
            minAlertLevel={volcanoMinAlert}
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showTsunamis && (
          <TsunamiMarkers
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showWildfires && (
          <WildfireMarkers
            minAcres={wildfireMinAcres}
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}
        {showDrought && (
          <DroughtLayer
            selectedCategory={droughtCategory}
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}

        {/* Air quality – fetches only for the state selected */}
        {showAirQuality && (
          <AirQualityMarkers
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}

        {/* Noise pollution - loads image tile map for selected area */}
        {showNoisePollution && <NoisePollutionLayer/>}

        {/* NASA satellite layers – raster tiles straight from NASA GIBS */}
        {nasaLayerIds.length > 0 && (
          <NasaLayers
            layerIds={nasaLayerIds}
            date={nasaDate}
            onDateChange={onNasaDateChange}
            setLoading={setLoading}
          />
        )}

        {/* Rural access to intercity transportation – county choropleth */}
        {showRuralAccess && (
          <RuralAccessChoropleth
            year={ruralAccessYear}
            onYearChange={onRuralAccessYearChange}
            setLoading={setLoading}
          />
        )}
        {showBreastCancerIncidence && (
        <BreastCancerIncidenceChoropleth />
        )}
        {/* Waste treatment/disposal sites – fetches only for the state selected */}
        {showWasteTreatmentDisposal && (
          <WasteTreatmentDisposalMarkers selectedStateCode={clickedStateCode} setLoading={setLoading} />
        )}

        {/* GHG emissions – shown when GHG Emissions is selected in sidebar */}
        {showGHGEmissions && (
          <GhgEmissionsMarkers selectedStateCode={clickedStateCode} setLoading={setLoading} />
        )}

        {/* Data centers – shown when Data Centers is selected in sidebar */}
        {showDataCenters && <DataCenterMarkers setLoading={setLoading}/>}

        {politicalLayerIds.includes("senators") && <SenatorMarkers setLoading={setLoading}/>}
        {politicalLayerIds.includes("governors") && <GovernorMarkers />}
        {(politicalLayerIds.includes("president") ||
          politicalLayerIds.includes("vice-president")) && (
          <PresidentMarker
            showPresident={politicalLayerIds.includes("president")}
            showVicePresident={politicalLayerIds.includes("vice-president")}
            setLoading={setLoading}
          />
        )}
        {politicalLayerIds.includes("house") && <HouseMarkers setLoading={setLoading}/>}
        {politicalLayerIds.includes("supreme-court") && <SupremeCourtMarkers/>}
        {politicalLayerIds.includes("gerrymandering") && <GerrymanderingMarkers />}

        {/* TESTING - Case by case police killings */}
        <PoliceKillings
          showPoliceKillingData={showPoliceKillingData}
          timelineRange={markerTimelineRange}
          onDateRangeChange={onDateRangeChange}
        />
        <PoliceShootings show={showPoliceShootings} setLoading={setLoading} />

        {showAlprCameras && (
          <AlprCameraMarkers flockOnly={alprFlockOnly} setLoading={setLoading} />
        )}

        {/* TESTING - State markers with arrest data */}
        <ArrestMarkers arrestCategory={arrestCategory} showArrestData={showArrestData}></ArrestMarkers>

        <MissingPersons
          showMissingPersonsData={showMissingPersonsData}
          timelineRange={markerTimelineRange}
          onDateRangeChange={onDateRangeChange}
        />

        {showMassShootings && (
          <MassShootingMarkers
            setLoading={setLoading}
            timelineRange={markerTimelineRange}
            onDateRangeChange={onDateRangeChange}
          />
        )}

        <ConsentAge showConsentAgeData={showConsentAgeData}></ConsentAge>

        <ZoomControl position="topright" />
      </MapContainer>

      {/* Boxes made for Hawaii and Alaska in bottom left corner - locked to map container */}
      {(alaska || hawaii) && !hideInsets && (
        <div
          className="absolute bottom-6 z-[2000] flex items-end gap-4 transition-[left] duration-300"
          style={{ left: sidebarOffsetPx + 16 }}
        >
          {alaska && (
            <InsetMap
              feature={alaska as Feature<Geometry>}
              label="AK"
              className="h-32 w-48 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-lg"
              interactive
              fixedBounds={AK_BOUNDS}
              onFocus={focusAK}
              allowWrap={true}
            />
          )}
          {hawaii && (
            <InsetMap
              feature={hawaii as Feature<Geometry>}
              label="HI"
              className="h-24 w-40 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-lg"
              interactive
              fixedBounds={HI_BOUNDS}
              onFocus={focusHI}
            />
          )}
        </div>
      )}
    </div>
  );
}
