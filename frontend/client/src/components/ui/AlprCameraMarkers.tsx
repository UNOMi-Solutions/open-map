import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/apiClient";

type AlprCamera = {
  kind: "camera";
  id: string;
  lat: number;
  lon: number;
  manufacturer: string | null;
  operator: string | null;
  surveillance: string | null;
  zone: string | null;
  direction: string | null;
  mount: string | null;
  name: string | null;
  flock: boolean;
};

type AlprCluster = {
  kind: "cluster";
  lat: number;
  lon: number;
  count: number;
  flock: number;
};

type AlprFeature = AlprCamera | AlprCluster;

type AlprResponse = {
  status: "loading" | "ready" | "error";
  regionsDone?: number;
  regionsTotal?: number;
  totalInView?: number;
  error?: string | null;
  features?: AlprFeature[];
};

type AlprCameraMarkersProps = {
  flockOnly?: boolean;
  setLoading: (loading: boolean) => void;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pretty(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDirection(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  return /^-?\d+(\.\d+)?$/.test(text) ? `${text}°` : text;
}

function osmHref(id: string): string | null {
  const match = /^(node|way)\/(\d+)$/.exec(id);
  if (!match) return null;
  return `https://www.openstreetmap.org/${match[1]}/${match[2]}`;
}

function popupHtml(camera: AlprCamera): string {
  const title = camera.name || (camera.flock ? "Flock Safety ALPR" : "ALPR camera");
  const watches = [pretty(camera.surveillance), pretty(camera.zone)].filter(Boolean).join(" · ");
  const rows: Array<[string, string | null]> = [
    ["Manufacturer", camera.manufacturer],
    ["Operator", camera.operator && camera.operator !== camera.manufacturer ? camera.operator : null],
    ["Watches", watches || null],
    ["Direction", formatDirection(camera.direction)],
    ["Mount", pretty(camera.mount)],
  ];
  const body = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value]) =>
        `<p style="margin:2px 0 0;font-size:12px;"><strong>${label}:</strong> ${esc(value)}</p>`,
    )
    .join("");
  const href = osmHref(camera.id);
  const link = href
    ? `<p style="margin:6px 0 0;font-size:12px;"><a href="${href}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>`
    : "";
  return `
    <div style="min-width:180px;max-width:280px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${esc(title)}</h3>
      <p style="margin:0 0 6px;font-size:12px;color:#555;">License plate reader</p>
      ${body}
      ${link}
    </div>`;
}

function clusterSize(count: number): number {
  const size = 20 + Math.log2(Math.max(2, count)) * 2.6;
  return Math.round(Math.min(34, Math.max(22, size)));
}

function compactCount(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return thousands >= 10 ? `${Math.round(thousands)}k` : `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
}

function legendNote(data: AlprResponse | null, clustered: boolean): string {
  if (!data) return "Loading cameras…";
  if (data.status === "error") return data.error || "OpenStreetMap is unavailable";
  if (data.status === "loading") {
    const progress = data.regionsTotal ? ` (${data.regionsDone ?? 0}/${data.regionsTotal})` : "";
    if ((data.totalInView ?? 0) > 0) {
      return `${(data.totalInView ?? 0).toLocaleString()} cameras so far · still loading${progress}`;
    }
    return `Loading cameras${progress}`;
  }
  const bits = [`${(data.totalInView ?? 0).toLocaleString()} in this view`];
  if (clustered) bits.push("zoom in to separate them");
  bits.push("OpenStreetMap");
  return bits.join(" · ");
}

const AlprCameraMarkers = ({ flockOnly = false }: AlprCameraMarkersProps) => {
  const map = useMap();
  const [data, setData] = useState<AlprResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let requestId = 0;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void run();
      }, ms);
    };

    const run = async () => {
      const mine = ++requestId;
      const bounds = map.getBounds();
      const params = new URLSearchParams({
        south: bounds.getSouth().toFixed(4),
        west: bounds.getWest().toFixed(4),
        north: bounds.getNorth().toFixed(4),
        east: bounds.getEast().toFixed(4),
        zoom: String(Math.round(map.getZoom())),
        flockOnly: flockOnly ? "1" : "0",
      });
      try {
        const next = await apiGet<AlprResponse>(`/api/v1/flock/cameras?${params}`);
        if (cancelled || mine !== requestId) return;
        setData((prev) => {
          if (
            prev &&
            prev.status === next.status &&
            prev.regionsDone === next.regionsDone &&
            prev.totalInView === next.totalInView &&
            (prev.features?.length ?? 0) === (next.features?.length ?? 0)
          ) {
            return prev;
          }
          return next;
        });
        if (next.status === "loading") schedule(3500);
        else if (next.status === "error") schedule(15000);
      } catch (error) {
        console.error("[AlprCameraMarkers] Fetch error:", error);
        if (cancelled || mine !== requestId) return;
        setData({
          status: "error",
          error: "Unable to load ALPR cameras",
          features: [],
        });
        schedule(15000);
      }
    };

    const onMove = () => schedule(450);
    void run();
    map.on("moveend", onMove);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      map.off("moveend", onMove);
    };
  }, [map, flockOnly]);

  useEffect(() => {
    const features = data?.features ?? [];
    const group = L.layerGroup();
    let clustered = false;
    const zoom = map.getZoom();
    const lens = zoom < 6 ? 12 : zoom < 11 ? 14 : 18;

    for (const feature of features) {
      if (feature.kind === "cluster") {
        clustered = true;
        const size = clusterSize(feature.count);
        const mostlyFlock = feature.flock / feature.count >= 0.5;
        const icon = L.divIcon({
          className: "alpr-marker",
          html: `<div class="alpr-bubble${mostlyFlock ? " flock" : ""}" style="width:${size}px;height:${size}px">${compactCount(feature.count)}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([feature.lat, feature.lon], { icon, zIndexOffset: size });
        marker.bindTooltip(`${feature.count.toLocaleString()} cameras`, {
          direction: "top",
          offset: [0, -size / 2],
        });
        marker.on("click", () => {
          map.setView([feature.lat, feature.lon], Math.min(map.getZoom() + 2, 18));
        });
        marker.addTo(group);
        continue;
      }

      const icon = L.divIcon({
        className: "alpr-marker",
        html: `<div class="alpr-lens ${feature.flock ? "flock" : "other"}" style="width:${lens}px;height:${lens}px"></div>`,
        iconSize: [lens, lens],
        iconAnchor: [lens / 2, lens / 2],
      });
      L.marker([feature.lat, feature.lon], { icon })
        .bindPopup(() => popupHtml(feature), { maxWidth: 300 })
        .addTo(group);
    }
    group.addTo(map);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const rows = [
        flockOnly
          ? ""
          : `<div class="point-legend-row"><span class="alpr-lens other legend-lens"></span>Other ALPR</div>`,
        `<div class="point-legend-row"><span class="alpr-lens flock legend-lens"></span>Flock Safety</div>`,
        clustered
          ? `<div class="point-legend-row"><span class="alpr-bubble legend-bubble${flockOnly ? " flock" : ""}">#</span>Several nearby</div>`
          : "",
      ].join("");
      div.innerHTML =
        `<h4>ALPR cameras</h4>` +
        rows +
        `<div class="legend-note">${esc(legendNote(data, clustered))}</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.removeLayer(group);
      map.removeControl(legend);
    };
  }, [map, data, flockOnly]);

  return null;
};

export default AlprCameraMarkers;
