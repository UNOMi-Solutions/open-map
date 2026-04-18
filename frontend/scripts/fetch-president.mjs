/**
 * Fetches the current U.S. president from GovTrack and writes
 * client/public/data/president.json (single pin near the White House).
 * Run: node scripts/fetch-president.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Approx. White House — distinct from generic “DC center”. */
const DC_PIN = { lat: 38.8977, lng: -77.0365 };

function photoUrlFromGovTrackLink(link) {
  if (!link || typeof link !== "string") return null;
  const m = link.trim().match(/\/(\d+)\s*$/);
  if (!m) return null;
  return `https://www.govtrack.us/static/legislator-photos/${m[1]}-200px.jpeg`;
}

async function main() {
  const url =
    "https://www.govtrack.us/api/v2/role?current=true&role_type=president&limit=5";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GovTrack ${res.status}`);
  const data = await res.json();
  const role = (data.objects ?? [])[0];
  if (!role) throw new Error("No current president role returned");

  const person = role.person ?? {};
  const link = person.link ?? "";
  const payload = {
    source: "https://www.govtrack.us/api/v2/role (current president)",
    fetchedAt: new Date().toISOString(),
    president: {
      id: `pres-${link.match(/\/(\d+)\s*$/)?.[1] ?? "current"}`,
      name: person.name ?? `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim(),
      title: role.title_long ?? role.title ?? "President of the United States",
      party: role.party ?? "",
      description: role.description ?? "",
      website: role.website || link || "",
      photoUrl: photoUrlFromGovTrackLink(link),
      lat: DC_PIN.lat,
      lng: DC_PIN.lng,
    },
  };

  const dest = join(__dirname, "..", "client", "public", "data", "president.json");
  writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote president to ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
