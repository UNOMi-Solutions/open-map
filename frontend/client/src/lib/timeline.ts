export type TimelineDateRange = {
  start: number;
  end: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function getTimelineDateRange(
  dates: Array<Date | null>,
): TimelineDateRange | null {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;

  for (const date of dates) {
    if (!date || !Number.isFinite(date.getTime())) continue;
    const timestamp = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    start = Math.min(start, timestamp);
    end = Math.max(end, timestamp);
  }

  return Number.isFinite(start) ? { start, end } : null;
}

export function isDateInTimelineRange(
  date: Date | null,
  range: TimelineDateRange | null,
): boolean {
  if (!range) return true;
  if (!date || !Number.isFinite(date.getTime())) return false;
  const timestamp = date.getTime();
  return timestamp >= range.start && timestamp < range.end + DAY_IN_MS;
}

export function formatTimelineDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
