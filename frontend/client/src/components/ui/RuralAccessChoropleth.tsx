// Rural Access – county map of the share of rural residents with access to scheduled intercity air, bus, or rail service (BTS).
// Counties come from the repo's TopoJSON; BTS attributes are joined by 5-digit FIPS.
import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

// mirrors backend /transportation/ruralAccess
type RuralAccessRow = {
  geoid: string;
  name: string;
  state: string;
  ruralpop: number | null; // optional fields
  totpop: number | null;
  paccall: number | null;
  paccair: number | null;
  paccbus: number | null;
  paccrail: number | null;
  cntair: number | null;
  cntbus: number | null;
  cntrail: number | null;
  cntall: number | null;
};
type RuralAccessResponse = {
  year: number;
  availableYears: number[];
  attribution: string;
  sourceUrl: string;
  total: number;
  rows: RuralAccessRow[];
};

type County = { name: string };
type CountyFeature = Feature<
  Polygon | MultiPolygon,
  County & { access?: RuralAccessRow }
>;

export const RURAL_ACCESS_DEFAULT_YEAR = 2021;

// scales bands over the 0–100 percent range so colors are consistent
const BANDS = [0, 25, 50, 75, 90];
const BAND_COLORS = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];
const NO_DATA_COLOR = "#d4d4d8";

function colorFor(pct: number | null | undefined): string {
  if (pct == null) return NO_DATA_COLOR;
  for (let i = BANDS.length - 1; i >= 0; i--) {
    if (pct >= BANDS[i]) return BAND_COLORS[i];
  }
  return BAND_COLORS[0];
}

const fmtPct = (v: number | null) => (v == null ? "n/a" : `${v.toFixed(1)}%`);
const fmtInt = (v: number | null) => (v == null ? "n/a" : v.toLocaleString());

function popupHtml(
  row: RuralAccessRow | undefined,
  countyName: string,
  year: number,
): string {
  if (!row) {
    return `<div style="min-width:200px"><h3 style="margin:0 0 6px;font-size:15px;font-weight:700">${countyName}</h3>
      <p style="margin:0;font-size:12px">No BTS record for this county (${year}).</p></div>`;
  }
  const noRural = row.ruralpop === 0 || row.paccall == null;
  return `
    <div style="min-width:220px">
      <h3 style="margin:0 0 6px;font-size:15px;font-weight:700">${row.name}, ${row.state}</h3>
      <p style="margin:0;font-size:12px">Rural population: <strong>${fmtInt(row.ruralpop)}</strong> of ${fmtInt(row.totpop)}</p>
      ${
        noRural
          ? `<p style="margin:4px 0 0;font-size:12px;color:#555">No rural population or data not available.</p>`
          : `<p style="margin:4px 0 0;font-size:12px">With access to any mode: <strong>${fmtPct(row.paccall)}</strong></p>
           <p style="margin:2px 0 0;font-size:12px">Air ${fmtPct(row.paccair)} · Bus ${fmtPct(row.paccbus)} · Rail ${fmtPct(row.paccrail)}</p>
           <p style="margin:2px 0 0;font-size:12px;color:#555">Facilities within reach: ${fmtInt(row.cntall)} (air ${fmtInt(row.cntair)}, bus ${fmtInt(row.cntbus)}, rail ${fmtInt(row.cntrail)})</p>`
      }
      <p style="margin:6px 0 0;font-size:11px;color:#777">BTS, ${year}</p>
    </div>`;
}

// year selection menu
type Props = {
  year?: number;
  setLoading?: (state: boolean) => void;
};

const RuralAccessChoropleth = ({
  year = RURAL_ACCESS_DEFAULT_YEAR,
  setLoading,
}: Props) => {
  const map = useMap();
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const legendRef = useRef<L.Control | null>(null);

  const [counties, setCounties] = useState<CountyFeature[]>([]);
  const [data, setData] = useState<RuralAccessResponse | null>(null);

  // county geometry (same TopoJSON NaturalDisasterIncidentMarkers uses)
  useEffect(() => {
    fetch("/geo/counties-10m.json")
      .then((r) => r.json())
      .then((topo: Topology) => {
        const fc = feature(
          topo,
          topo.objects.counties as GeometryCollection<County>,
        ) as FeatureCollection<Polygon | MultiPolygon, County>;
        setCounties(fc.features as CountyFeature[]);
      })
      .catch((err) =>
        console.error("[RuralAccessChoropleth] Failed to load counties:", err),
      );
  }, []);

  // BTS attributes through caching system (one-shot, so the global loading bar fits)
  useEffect(() => {
    let cancelled = false;
    setLoading?.(true);
    cachedApiGet<RuralAccessResponse>(
      `transportation:ruralAccess:${year}`,
      `/api/v1/transportation/ruralAccess?year=${year}`,
      CACHE_TTL.RURAL_ACCESS,
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error("[RuralAccessChoropleth] Fetch error:", err);
        if (!cancelled) setData(null);
      })
      .finally(() => setLoading?.(false));
    return () => {
      cancelled = true;
      setLoading?.(false);
    };
  }, [year, setLoading]);

  const byFips = useMemo(() => {
    const m = new Map<string, RuralAccessRow>();
    for (const r of data?.rows ?? []) m.set(r.geoid, r);
    return m;
  }, [data]);

  // display choropleth and legend
  useEffect(() => {
    if (geoLayerRef.current) map.removeLayer(geoLayerRef.current); // referesh layer
    if (legendRef.current) map.removeControl(legendRef.current); // clear legend
    geoLayerRef.current = null;
    legendRef.current = null;
    if (!counties.length || !data) return;

    // copies datapoints from counties to BTS maps
    // features is the same list of county shapes, 
    // each now carrying properties.access that colorFor(...) and popupHtml(...) read directly
    const features: CountyFeature[] = counties.map((f) => ({
      ...f, 
      properties: {
        ...f.properties, // reference copy saves having to copy polygons of each county
        access: byFips.get(String(f.id).padStart(5, "0")), // pad geometry to match backend names
      },
    }));

    const geoLayer = L.geoJSON(
      { type: "FeatureCollection", features } as FeatureCollection,
      {
        style: (feat) => ({
          fillColor: colorFor(
            (feat as CountyFeature).properties.access?.paccall,
          ),
          weight: 0.5,
          color: "#fff",
          opacity: 1,
          fillOpacity: 0.75,
        }),
        onEachFeature: (feat, layer) => {
          const props = (feat as CountyFeature).properties;
          layer.bindPopup(
            () => popupHtml(props.access, props.name, data.year),
            { maxWidth: 300 },
          );
          layer.on({
            mouseover: (e) => {
              const t = e.target as L.Path;
              t.setStyle({ weight: 2, color: "#333", fillOpacity: 0.9 });
              t.bringToFront();
            },
            mouseout: (e) => geoLayer.resetStyle(e.target as L.Path),
          });
        },
      },
    );
    geoLayer.addTo(map);
    geoLayerRef.current = geoLayer;

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "choropleth-info choropleth-legend");
      div.innerHTML = `<h4>Rural residents with intercity transportation access (%)</h4>`;
      BANDS.forEach((lo, i) => {
        const hi = BANDS[i + 1];
        div.innerHTML += `<i style="background:${BAND_COLORS[i]}"></i> ${hi != null ? `${lo}–${hi}` : `${lo}+`}<br/>`;
      });
      div.innerHTML +=
        '<i style="background:${NO_DATA_COLOR}"></i> No rural population / not available<br/>';
      div.innerHTML += `<small>${data.year}. Rural = Census block groups outside urban areas, summarized by county.<br/>Source: ${data.attribution}</small>`;
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
      if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);
      if (legendRef.current) map.removeControl(legendRef.current);
      geoLayerRef.current = null;
      legendRef.current = null;
    };
  }, [counties, data, byFips, map]);

  return null;
};

export default RuralAccessChoropleth;
