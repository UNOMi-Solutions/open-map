// A fixed count scale keeps Home Invasions colors comparable between states and years.
export function homeInvasionFill(total?: number): string {
  if (total === undefined || !Number.isFinite(total) || total < 0) return "#94a3b8";
  const intensity = Math.sqrt(total / (total + 10000));
  // Fully saturated yellow-to-red colors stay vivid at the layer's fixed opacity.
  return `hsl(${60 * (1 - intensity)}, 100%, 50%)`;
}

// Circle area grows with site count, with a cap to keep overview clusters readable.
export function superfundCircleDiameter(count: number): number {
  return Math.min(64, 18 + 6 * Math.sqrt(Math.max(1, count) - 1));
}

// A zoom-dependent pixel grid splits and regroups sites without moving individual coordinates.
export function groupLocationSites<T extends { id: string; latitude: number; longitude: number }>(
  sites: T[], zoom: number, project: (latitude: number, longitude: number) => { x: number; y: number },
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const site of sites) {
    const point = project(site.latitude, site.longitude);
    // Keep coincident records together so every record can be selected at max zoom.
    const key = zoom >= 14 ? `${site.latitude}:${site.longitude}` : `${Math.floor(point.x / 64)}:${Math.floor(point.y / 64)}`;
    const group = groups.get(key);
    if (group) group.push(site);
    else groups.set(key, [site]);
  }
  return Array.from(groups.entries());
}

export const groupSuperfundSites = groupLocationSites;
