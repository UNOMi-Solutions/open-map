/** Tailwind classes for party labels in map popups (GovTrack uses "Democrat" / "Republican"). */
export function partyClassName(party: string): string {
  const l = party.toLowerCase();
  if (l.includes("republican")) return "text-red-600 font-medium";
  if (l.includes("democrat")) return "text-blue-600 font-medium";
  return "";
}
