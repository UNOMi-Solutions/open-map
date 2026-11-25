export type TimelineDateRange = {
  start: number;
  end: number;
};

export type TimelineYearRange = {
  min: number;
  max: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseTimelineDate(
  value: string | number | null | undefined,
): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

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

export function getTimelineYearRange(
  range: TimelineDateRange | null,
): TimelineYearRange | null {
  if (!range) return null;
  return {
    min: new Date(range.start).getUTCFullYear(),
    max: new Date(range.end).getUTCFullYear(),
  };
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

// ---- Shared by DateTimeline and the datasets that feed it ----

export const DAY_MS = DAY_IN_MS;

/** What a dataset reports to the global timeline alongside its date range. */
export type TimelineDatasetMeta = {
  /** Shown in the timeline header so people know which map the dates belong to */
  label?: string;
  /** The dataset shows one date at a time (economics, NASA) rather than a span */
  single?: boolean;
  /** Sorted UTC-midnight timestamps that hold data; any other day is "no data" */
  availableDates?: number[];
};

/** Midnight UTC of the given instant. */
export function toUtcDay(timestamp: number): number {
  const d = new Date(timestamp);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** The available date closest to `timestamp` (ties go to the earlier one). */
export function snapToAvailable(dates: number[] | undefined, timestamp: number): number {
  if (!dates?.length) return timestamp;
  let lo = 0;
  let hi = dates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < timestamp) lo = mid + 1;
    else hi = mid;
  }
  const after = dates[lo];
  const before = dates[Math.max(0, lo - 1)];
  return timestamp - before <= after - timestamp ? before : after;
}

/** The latest available date on or before `timestamp` (the first one when it is earlier than all). */
export function snapOnOrBefore(dates: number[] | undefined, timestamp: number): number {
  if (!dates?.length) return timestamp;
  let lo = 0;
  let hi = dates.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (dates[mid] <= timestamp) lo = mid;
    else hi = mid - 1;
  }
  return dates[lo] <= timestamp ? dates[lo] : dates[0];
}

/** Days that are gaps in every list (sorted, non-overlapping ranges in each). */
export function intersectGaps(lists: TimelineDateRange[][]): TimelineDateRange[] {
  if (!lists.length) return [];
  return lists.reduce((acc, list) => {
    const out: TimelineDateRange[] = [];
    let i = 0;
    let j = 0;
    while (i < acc.length && j < list.length) {
      const start = Math.max(acc[i].start, list[j].start);
      const end = Math.min(acc[i].end, list[j].end);
      if (start <= end) out.push({ start, end });
      if (acc[i].end < list[j].end) i++;
      else j++;
    }
    return out;
  });
}

/** Step `steps` available dates (or days, when every day is valid) away from `timestamp`. */
export function stepDate(
  dates: number[] | undefined,
  timestamp: number,
  steps: number,
  min: number,
  max: number,
): number {
  if (!dates?.length) return Math.min(max, Math.max(min, timestamp + steps * DAY_IN_MS));
  const index = dates.indexOf(snapToAvailable(dates, timestamp));
  return dates[Math.min(dates.length - 1, Math.max(0, index + steps))];
}

/**
 * Spans inside [min, max] with no data: before the first and after the last available date,
 * and any gap noticeably longer than the dataset's usual spacing (1.5x the median step, so a
 * monthly product's 28 to 31 day steps are not flagged but a missing month is).
 */
export function findDateGaps(
  dates: number[] | undefined,
  min: number,
  max: number,
): TimelineDateRange[] {
  if (!dates?.length) return [];
  const gaps: TimelineDateRange[] = [];
  if (dates[0] > min) gaps.push({ start: min, end: dates[0] - DAY_IN_MS });
  if (dates.length > 2) {
    const steps = dates.slice(1).map((d, i) => d - dates[i]).sort((a, b) => a - b);
    const usual = steps[steps.length >> 1];
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] - dates[i - 1] > usual * 1.5) {
        gaps.push({ start: dates[i - 1] + usual, end: dates[i] - DAY_IN_MS });
      }
    }
  }
  const last = dates[dates.length - 1];
  if (last < max) gaps.push({ start: last + DAY_IN_MS, end: max });
  return gaps.filter((g) => g.end >= g.start);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Typed dates, read as UTC days: 2026-01-10, 2026-1-10, 01/10/2026, 1/10/26, Jan 10 2026,
 * 10 Jan 2026, January 2026 (first of month), 2026-01, 2026. Returns null when unreadable.
 */
export function parseDateInput(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
  const make = (y: number, m: number, d = 1) => {
    const t = Date.UTC(y, m - 1, d);
    const back = new Date(t);
    return back.getUTCMonth() === m - 1 && back.getUTCDate() === d && y >= 1000 ? t : null;
  };
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return make(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) return make(year(m[3]), +m[1], +m[2]);
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) return make(+m[1], +m[2]);
  if ((m = s.match(/^(\d{4})$/))) return make(+m[1], 1);
  const month = (w: string) => MONTHS.indexOf(w.slice(0, 3)) + 1;
  if ((m = s.match(/^(?:[a-z]+ )?([a-z]{3,}) (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/)) && month(m[1])) return make(+m[3], month(m[1]), +m[2]);
  if ((m = s.match(/^(\d{1,2}) ([a-z]{3,}) (\d{4})$/)) && month(m[2])) return make(+m[3], month(m[2]), +m[1]);
  if ((m = s.match(/^([a-z]{3,}) (\d{4})$/)) && month(m[1])) return make(+m[2], month(m[1]));
  return null;
}

/** "Tue, Jan 10, 2026" */
export function formatLongDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Jan 10, 2026" */
export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
