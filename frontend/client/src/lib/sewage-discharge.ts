import { groupLocationSites } from "./datapoint-map-style";

export interface SewageOutfall {
  id: string;
  permitId: string;
  outfallNumber: string;
  name: string;
  facilityName: string;
  city: string;
  state: string;
  waterbody: string;
  treatment: string;
  permitStatus: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
}

// Keep coincident pipes selectable together instead of stacking inaccessible markers.
export function groupSewageOutfalls(
  outfalls: SewageOutfall[], zoom: number,
  project: (latitude: number, longitude: number) => { x: number; y: number },
): Array<[string, SewageOutfall[]]> {
  if (zoom < 14) return groupLocationSites(outfalls, zoom, project);
  const groups = new Map<string, SewageOutfall[]>();
  for (const outfall of outfalls) {
    const key = `${outfall.latitude}:${outfall.longitude}`;
    const group = groups.get(key);
    if (group) group.push(outfall);
    else groups.set(key, [outfall]);
  }
  return Array.from(groups.entries());
}
