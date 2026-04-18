import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import L, { LatLngBounds, LatLngBoundsExpression } from "leaflet";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";

function boundsOf(geo: Feature<Geometry, GeoJsonProperties>): LatLngBounds {
  const layer = L.geoJSON(geo as any);
  const b = layer.getBounds();
  layer.remove();
  return b;
}

export default function InsetMap({
  className,
  feature,
  label,
  interactive = false,
  fixedBounds,      // <- optional override to avoid weird natural bounds
  onFocus,
  allowWrap = false, // Allow tile wrapping (useful for Alaska)
}: {
  className?: string;
  feature: Feature<Geometry, GeoJsonProperties>;
  label: string;
  interactive?: boolean;
  fixedBounds?: LatLngBoundsExpression;
  onFocus?: () => void;
  allowWrap?: boolean;
}) {
  const b = fixedBounds ?? boundsOf(feature);

  const containerClasses = [
    "relative",
    interactive ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
    className ?? "",
  ].join(" ");

  return (
    <div className={containerClasses}>
      <MapContainer
        bounds={b}
        boundsOptions={{ padding: [10, 10] }}
        zoomControl={false}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
        attributionControl={false}
        className="h-full w-full"
        preferCanvas
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          noWrap={!allowWrap}
          maxZoom={19}
        />
        <GeoJSON
          data={feature as any}
          interactive={false}
          style={{
            color: "#0a3b55",
            weight: 1,
            fillOpacity: 0,
            fill: false,
          }}
        />
      </MapContainer>

      {/* Click-capture overlay to ensure focus even if Leaflet stops bubbling */}
      {interactive && (
        <button
          type="button"
          onClick={onFocus}
          className="absolute inset-0 z-[10000] pointer-events-auto"
          aria-label={`Focus ${label}`}
          style={{ background: "transparent" }}
        />
      )}

      {/* Corner label */}
      <span className="absolute bottom-1 right-1 rounded bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white select-none">
        {label}
      </span>
    </div>
  );
}