// Noise Pollution – Bureau of Transportation Statistics National Transportation Noise Map 2022 as raster tile overlays
// one per BTS service: [CONUS, Alaska, Hawaii]
import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

// /noiseTransportation response
type NoiseExtent = { xmin: number; ymin: number; xmax: number; ymax: number };

type NoiseMeta = {
  attribution: string;
  metric: string;
  legend: { label: string; imageData: string; contentType: string }[];
  services: {
    region: "CONUS" | "Alaska" | "Hawaii";
    tileUrlTemplate: string;
    maxNativeZoom: number;
    fullExtent?: NoiseExtent;
  }[];
};

const NOISE_API_PATH = "/api/v1/environment/noiseTransportation";
export const NOISE_DEFAULT_OPACITY = 0.6; // README default

// 1x1 transparent PNG so tiles outside coverage doesn't show
const BLANK_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const ALASKA_BOUNDS: L.LatLngBoundsLiteral[] = [
  [
    [51, -180], [72, -129],
  ],
  [
    [51, 172], [54, 180],
  ],
];

function boundsFor(
  region: NoiseMeta["services"][number]["region"],
  extent?: NoiseExtent,
): L.LatLngBounds[] {
  if (region === "Alaska") return ALASKA_BOUNDS.map((b) => L.latLngBounds(b));
  const b = toBounds(extent);
  return b ? [b] : [];
}

// View Extent arrives in Web Mercator. Un-project it so Leaflet skips tile requests outside each view
function toBounds(extent?: NoiseExtent): L.LatLngBounds | undefined {
  if (!extent) return undefined;
  const sw = L.CRS.EPSG3857.unproject(L.point(extent.xmin, extent.ymin));
  const ne = L.CRS.EPSG3857.unproject(L.point(extent.xmax, extent.ymax));
  if (ne.lng - sw.lng > 180) return undefined; // filter out of bounds
  return L.latLngBounds(sw, ne);
}

type Props = { opacity?: number; showLegend?: boolean };

const NoisePollutionLayer = ({
  opacity = NOISE_DEFAULT_OPACITY,
  showLegend = true,
}: Props) => {
  const map = useMap();
  const tilesRef = useRef<L.TileLayer[]>([]);
  const legendRef = useRef<L.Control | null>(null);
  const [meta, setMeta] = useState<NoiseMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    cachedApiGet<NoiseMeta>(
      "environment:noiseTransportation:v3",
      NOISE_API_PATH,
      CACHE_TTL.NOISE_TRANSPORTATION,
    )
      .then((m) => {
        if (cancelled) return;
        if (!Array.isArray(m?.services)) {
          console.error("[NoisePollutionLayer] Unexpected response shape:", m);
          return;
        }
        setMeta(m);
      })
      .catch((err) => console.error("[NoisePollutionLayer] Fetch error:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!meta) return;

    meta.services.forEach((s) =>
      console.log(
        s.region,
        s.fullExtent,
        toBounds(s.fullExtent)?.toBBoxString() ?? "NO BOUNDS",
      ),
    );
    // one tile layer per service
    tilesRef.current = meta.services.flatMap((svc) =>
      boundsFor(svc.region, svc.fullExtent).map((bounds) =>
        L.tileLayer(svc.tileUrlTemplate, {
          opacity,
          attribution: meta.attribution,
          maxNativeZoom: svc.maxNativeZoom,
          maxZoom: 19,
          bounds,
          errorTileUrl: BLANK_TILE,
          noWrap: true,
          zIndex: 5,
        }).addTo(map),
      ),
    );

    // create legend view
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "choropleth-info choropleth-legend");
      div.style.fontSize = "12px";
      div.style.lineHeight = "1.4";
      div.style.maxWidth = "240px";

      // content comes from the BTS service via backend
      const rows = meta.legend
        .map(
          (e) =>
            `<div style="display:flex;align-items:center;gap:6px">
           <img src="data:${e.contentType};base64,${e.imageData}" width="14" height="14"
                style="display:inline-block;flex:none;max-width:none"/>
           <span>${e.label}</span>
         </div>`,
        )
        .join("");
      div.innerHTML =
        `<h4 style="font-size:13px;margin:0 0 4px">Transportation Noise (dB LAeq, 24-hr)</h4>` +
        rows +
        `<small>Modeled 2022 values, transportation sources only.<br/>Source: ${meta.attribution}</small>`;
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
      tilesRef.current.forEach((t) => map.removeLayer(t));
      tilesRef.current = [];
      if (legendRef.current) map.removeControl(legendRef.current);
      legendRef.current = null;
    };
  }, [meta, opacity, map]);

  return null;
};

export default NoisePollutionLayer;
