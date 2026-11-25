// The map's right-hand column, under the zoom buttons: map legends on top, the sponsored unit
// below, scrolling together so neither covers the other. It stops above the timeline panel
// (via --timeline-height) instead of running behind it.
//
// Legends join it by appending their element to `.map-rail-legends` (see NasaLayers); the ad is
// passed in as `ad` and rendered here through a portal. Empty sections take no space.
import L from "leaflet";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";

export const MAP_RAIL_LEGENDS_CLASS = "map-rail-legends";

/** The rail's legend section, or null when the map has no rail (then use a normal control). */
export function getMapRailLegends(map: L.Map): HTMLElement | null {
  return map.getContainer().querySelector<HTMLElement>(`.${MAP_RAIL_LEGENDS_CLASS}`);
}

export default function MapRail({ ad }: { ad?: ReactNode }) {
  const map = useMap();
  const [adHost, setAdHost] = useState<HTMLElement | null>(null);

  // A plain effect, so the rail is added after the zoom control (rendered just before it) and sits
  // under the zoom buttons; legends load asynchronously and fall back to a control if it is missing
  useEffect(() => {
    const control = new L.Control({ position: "topright" });
    control.onAdd = () => {
      const rail = L.DomUtil.create("div", "map-rail");
      L.DomEvent.disableClickPropagation(rail);
      L.DomEvent.disableScrollPropagation(rail);
      L.DomUtil.create("div", MAP_RAIL_LEGENDS_CLASS, rail);
      setAdHost(L.DomUtil.create("div", "map-rail-ad", rail));
      return rail;
    };
    control.addTo(map);
    return () => {
      control.remove();
      setAdHost(null);
    };
  }, [map]);

  return adHost && ad ? createPortal(ad, adHost) : null;
}
