import L from "leaflet";

// Plugins like leaflet.heat attach to a global `L`, which the bundled leaflet import does not set.
// Import this module before any such plugin.
(window as unknown as { L: typeof L }).L = L;

export default L;
