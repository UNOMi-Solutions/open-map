// The one timeline panel for the map. Single-date datasets (economics, NASA) each keep their own
// day and appear as coloured dots on one ruler; span datasets (oil spills, storms, ...) share a
// range slider in the same panel. Built from DateTimeline in embedded mode.
//
// "All" (the default) moves every single-date dataset to the picked day, each snapping to the
// closest day it has data. Clicking a dataset's chip or dot focuses it, so the ruler moves only
// that dataset. Latest/Reset act on the focused dataset, or on all of them.
//
// The chevron folds the panel down to one line with the dates on show; the choice is remembered.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import DateTimeline, { type TimelineMarker } from "@/components/ui/DateTimeline";
import { publishTimelinePreview } from "@/lib/timelinePreview";
import {
  DAY_MS,
  findDateGaps,
  formatShortDate,
  intersectGaps,
  snapOnOrBefore,
  snapToAvailable,
  type TimelineDateRange,
} from "@/lib/timeline";

export type TimelineTrack = {
  id: string;
  label: string;
  /** Single-date datasets carry a colour; it is used for their dot, chip and legend outline */
  color?: string;
  single: boolean;
  min: number;
  max: number;
  availableDates?: number[];
  /** Single: { start: day, end: day }. Span datasets all share the same range. */
  value: TimelineDateRange;
};

type Props = {
  tracks: TimelineTrack[];
  /** New ranges keyed by dataset id; one commit can move several datasets */
  onChange: (changes: Record<string, TimelineDateRange>) => void;
  className?: string;
};

const NEUTRAL = "#e2e8f0";
const clamp = (t: number, min: number, max: number) => Math.min(max, Math.max(min, t));
// Each dataset shows its latest day with data on or before the picked day
const fitTrack = (t: TimelineTrack, day: number) => snapOnOrBefore(t.availableDates, clamp(day, t.min, t.max));
const day = (t: number) => ({ start: t, end: t });

const COLLAPSED_KEY = "openmap.timelineCollapsed";
const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
};

/** "Jun 1, 2010" or "Jun 1, 2010 – Nov 13, 2026" (year once when both share it). */
function spanText(a: number, b: number) {
  if (a === b) return formatShortDate(a);
  const sameYear = new Date(a).getUTCFullYear() === new Date(b).getUTCFullYear();
  const first = sameYear
    ? new Date(a).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
    : formatShortDate(a);
  return `${first} – ${formatShortDate(b)}`;
}

export default function MapTimeline({ tracks, onChange, className = "" }: Props) {
  const singles = useMemo(() => tracks.filter((t) => t.single), [tracks]);
  const spans = useMemo(() => tracks.filter((t) => !t.single), [tracks]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [allCursor, setAllCursor] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const panel = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Folded controls leave the tab order (React 18 types have no `inert` prop yet)
  useEffect(() => {
    body.current?.toggleAttribute("inert", collapsed);
  }, [collapsed]);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        // storage blocked: the choice lasts for this visit
      }
      return !c;
    });

  const focused = singles.find((t) => t.id === focusId) ?? null;
  useEffect(() => {
    if (focusId && !focused) setFocusId(null);
  }, [focusId, focused]);

  // Bottom-right map legends move up by the panel's height (see .timeline-visible-map in index.css)
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--timeline-height", `${el.offsetHeight}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--timeline-height");
    };
  }, []);

  // The ruler's scale: the focused dataset alone, or every single-date dataset together
  const ruler = useMemo(() => {
    const list = focused ? [focused] : singles;
    if (!list.length) return null;
    let availableDates: number[] | undefined;
    if (list.every((t) => t.availableDates?.length)) {
      const days = new Set<number>();
      for (const t of list) for (const d of t.availableDates!) days.add(d);
      availableDates = Array.from(days).sort((a, b) => a - b);
    }
    const min = Math.min(...list.map((t) => t.min));
    const max = Math.max(...list.map((t) => t.max));
    // "No data" only where no dataset has data, each judged by its own spacing
    // (a monthly layer's 30-day steps are not gaps next to a daily layer)
    const gaps = intersectGaps(
      list.map((t) =>
        [
          ...(t.min > min ? [{ start: min, end: t.min - DAY_MS }] : []),
          ...findDateGaps(t.availableDates, t.min, t.max),
          ...(t.max < max ? [{ start: t.max + DAY_MS, end: max }] : []),
        ].sort((a, b) => a.start - b.start),
      ),
    );
    return { min, max, availableDates, gaps };
  }, [focused, singles]);

  const cursor = focused
    ? focused.value.end
    : ruler && allCursor !== null
      ? snapToAvailable(ruler.availableDates, clamp(allCursor, ruler.min, ruler.max))
      : Math.max(...singles.map((t) => t.value.end));

  const moveSingles = (target: number) => {
    if (focused) return onChange({ [focused.id]: day(target) });
    setAllCursor(target);
    onChange(Object.fromEntries(singles.map((t) => [t.id, day(fitTrack(t, target))])));
  };
  const latest = () => {
    setAllCursor(null);
    const list = focused ? [focused] : singles;
    onChange(Object.fromEntries(list.map((t) => [t.id, day(fitTrack(t, t.max))])));
  };
  const atLatest = (focused ? [focused] : singles).every((t) => t.value.end === fitTrack(t, t.max));
  const toggleFocus = (id: string) => setFocusId((current) => (current === id || singles.length < 2 ? null : id));

  // Where a dataset lands while the bar moves: in All mode its own latest day on or before the bar;
  // when focused, only the focused one moves (the ruler already steps through its days)
  const predictFor = (t: TimelineTrack) =>
    focused ? (t.id === focused.id ? (d: number) => d : undefined) : (d: number) => fitTrack(t, d);
  const onDraft = (d: number | null) => {
    if (d === null) return publishTimelinePreview(null);
    const preview: Record<string, number> = {};
    for (const t of singles) {
      const p = predictFor(t);
      if (p) preview[t.id] = p(d);
    }
    publishTimelinePreview(preview);
  };
  useEffect(() => () => publishTimelinePreview(null), []);

  // One-line summary for the folded panel
  const singleDays = singles.map((t) => t.value.end);
  const summary = [
    singleDays.length ? spanText(Math.min(...singleDays), Math.max(...singleDays)) : null,
    spans.length ? spanText(spans[0].value.start, spans[0].value.end) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const markers: TimelineMarker[] = singles.map((t) => ({
    id: t.id,
    date: t.value.end,
    color: t.color ?? NEUTRAL,
    label: t.label,
    active: t.id === focusId,
    predict: predictFor(t),
  }));

  const spanBounds = spans.length
    ? { min: Math.min(...spans.map((t) => t.min)), max: Math.max(...spans.map((t) => t.max)), value: spans[0].value }
    : null;
  const spanAtDefault = spanBounds && spanBounds.value.start === spanBounds.min && spanBounds.value.end === spanBounds.max;

  const chip = (id: string | null, label: string, color: string | null) => {
    const selected = id === focusId;
    return (
      <button
        key={id ?? "all"}
        type="button"
        onClick={() => (id ? toggleFocus(id) : setFocusId(null))}
        aria-pressed={singles.length > 1 ? selected : undefined}
        disabled={singles.length < 2}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors disabled:cursor-default ${
          selected && singles.length > 1
            ? "border-white/60 bg-white/10 text-white"
            : "border-white/10 text-white/70 hover:border-white/30 hover:text-white disabled:hover:border-white/10 disabled:hover:text-white/70"
        }`}
      >
        {color && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="truncate">{label}</span>
      </button>
    );
  };

  return (
    <aside
      ref={panel}
      aria-label="Data timeline"
      className={`rounded-lg border border-white/15 bg-[#0c1022]/95 px-4 pb-2.5 pt-3 text-white shadow-2xl backdrop-blur ${className}`}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show timeline" : "Fold timeline"}
          className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        {/* folded: the dates on show, with each dataset's colour */}
        <button
          type="button"
          onClick={toggleCollapsed}
          tabIndex={collapsed ? 0 : -1}
          aria-hidden={!collapsed}
          className={`flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-white/80 transition-opacity duration-300 ${
            collapsed ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span className="flex shrink-0 -space-x-1">
            {singles.map((t) => (
              <span key={t.id} className="h-2 w-2 rounded-full ring-1 ring-[#0c1022]" style={{ background: t.color ?? NEUTRAL }} />
            ))}
          </span>
          <span className="truncate">{summary}</span>
        </button>
        {singles.length > 0 && (
          <button
            type="button"
            onClick={latest}
            disabled={atLatest}
            className="shrink-0 text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50"
          >
            Latest
          </button>
        )}
      </div>

      {/* folding animates the body's height to zero; the panel is pinned to the bottom, so it
          slides down and the map legends follow it through --timeline-height */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
        ref={body}
      >
        <div className="min-h-0 overflow-hidden">
        <div className="pt-2">

      {singles.length > 0 && ruler && (
        <>
          <div className="flex flex-wrap gap-1" role={singles.length > 1 ? "group" : undefined} aria-label="Datasets on the timeline">
            {singles.length > 1 && chip(null, "All", null)}
            {singles.map((t) => chip(t.id, t.label, t.color ?? NEUTRAL))}
          </div>
          <DateTimeline
            embedded
            mode="single"
            min={ruler.min}
            max={ruler.max}
            availableDates={ruler.availableDates}
            gaps={ruler.gaps}
            value={day(cursor)}
            accent={focused?.color ?? (singles.length === 1 ? singles[0].color : undefined) ?? NEUTRAL}
            markers={markers}
            onMarkerClick={toggleFocus}
            onDraft={onDraft}
            onCommit={(r) => moveSingles(r.end)}
          />
        </>
      )}

      {spanBounds && (
        <div className={singles.length ? "mt-2 border-t border-white/10 pt-3" : ""}>
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs text-white/60" title={spans.map((t) => t.label).join(", ")}>
              {spans.map((t) => t.label).join(", ")}
            </p>
            <button
              type="button"
              onClick={() => onChange(Object.fromEntries(spans.map((t) => [t.id, { start: spanBounds.min, end: spanBounds.max }])))}
              disabled={Boolean(spanAtDefault)}
              className="shrink-0 text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50"
            >
              Reset
            </button>
          </div>
          <DateTimeline
            embedded
            mode="range"
            min={spanBounds.min}
            max={spanBounds.max}
            value={spanBounds.value}
            onCommit={(r) => onChange(Object.fromEntries(spans.map((t) => [t.id, r])))}
          />
        </div>
      )}
        </div>
        </div>
      </div>
    </aside>
  );
}
