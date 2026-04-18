import { FIPS_TO_STATE } from "./fips-to-state";

/**
 * Census congressional GEOID (4 chars): ST(2) + CD(2). GovTrack uses `ST` + numeric district,
 * with 0 for at-large. Census uses 00 for at-large and 98 for delegate / territorial at-large.
 */
export function geoidToDistrictJoinKey(geoid: string | number | undefined | null): string | null {
  if (geoid == null) return null;
  const g = String(geoid).padStart(4, "0");
  if (g.length !== 4) return null;
  const fips = g.slice(0, 2);
  let cd = parseInt(g.slice(2), 10);
  const st = FIPS_TO_STATE[fips];
  if (!st) return null;
  if (Number.isNaN(cd)) return null;
  if (cd === 98) cd = 0;
  return `${st}-${cd}`;
}
