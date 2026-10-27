import type { CircleMarker, Map as LeafletMap, Path } from "leaflet";

/** Matches the continental US launch view so national-scale dots stay as they are. */
const BASE_ZOOM = 4;
const MAX_RADIUS = 20;

/** Size that small and large markers are pulled toward. */
const MID_RADIUS = 6.5;
/** Share of the original small-to-large gap to keep. */
const SPREAD = 0.82;
/** Extra radius on every marker so the smallest dots stay readable. */
const LIFT = 1;

/** Keep most of the size ranking, with every dot shifted slightly larger. */
export function markerBaseRadius(baseRadius: number): number {
  return MID_RADIUS + (baseRadius - MID_RADIUS) * SPREAD + LIFT;
}

/** Grow markers with zoom, a little faster for larger ones so the ranking stays easy to see. */
export function zoomScaledRadius(baseRadius: number, zoom: number): number {
  const steps = Math.max(0, zoom - BASE_ZOOM);
  const base = markerBaseRadius(baseRadius);
  return Math.min(MAX_RADIUS, base * (1 + steps * 0.03) + steps * 0.22);
}

export function bindZoomScaledRadius(
  map: LeafletMap,
  markers: Array<{ marker: CircleMarker; baseRadius: number }>,
): () => void {
  const apply = () => {
    const zoom = map.getZoom();
    for (const { marker, baseRadius } of markers) {
      marker.setRadius(zoomScaledRadius(baseRadius, zoom));
    }
  };
  apply();
  map.on("zoomend", apply);
  return () => {
    map.off("zoomend", apply);
  };
}

const MAX_WEIGHT = 12;

/** Grow path-segment stroke as the user zooms in so tracks stay visible at city scale. */
export function zoomScaledWeight(baseWeight: number, zoom: number): number {
  const steps = Math.max(0, zoom - BASE_ZOOM);
  return Math.min(MAX_WEIGHT, baseWeight * (1 + steps * 0.18));
}

export function bindZoomScaledWeight(
  map: LeafletMap,
  lines: Array<{ layer: Path; baseWeight: number }>,
): () => void {
  const apply = () => {
    const zoom = map.getZoom();
    for (const { layer, baseWeight } of lines) {
      layer.setStyle({ weight: zoomScaledWeight(baseWeight, zoom) });
    }
  };
  apply();
  map.on("zoomend", apply);
  return () => {
    map.off("zoomend", apply);
  };
}
