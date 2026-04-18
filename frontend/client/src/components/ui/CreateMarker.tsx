import L from "leaflet";

export const CreateMarker = (color: string) =>
  L.divIcon({
    className: "", // no extra wrapper styles needed
    html: `
      <div class="relative w-5 h-5">
        <!-- Pin -->
        <div class="absolute top-0 left-0 w-5 h-5 rounded-[50%_50%_50%_0] rotate-[-45deg] shadow-md" style="background-color: ${color}">
        </div>
      </div>
    `,
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -38],
  });