import L from "leaflet";
import "leaflet/dist/leaflet.css";

let patched = false;

export function patchLeafletIcons() {
  if (patched) return;
  patched = true;
  
  const iconRetina = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
  const icon = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
  const shadow = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetina,
    iconUrl: icon,
    shadowUrl: shadow,
  });
}