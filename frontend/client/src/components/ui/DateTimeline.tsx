// Global date control for every dated map layer.
//
//   <DateTimeline mode="single" min={...} max={...} value={{ start: d, end: d }}
//                 availableDates={[...]} title="Air Temperature" onCommit={setRange} />
//
// mode "range":  two-thumb slider (the oil spills / storm events style) with typed From/Through.
// mode "single": a ruler of day ticks with the selected day as a tall bar and its date above it.
//                Drag or click the ruler, scroll over it (one available date per notch; Shift
//                jumps further), use the arrow keys, or click the date and type one.
// Days without data (outside availableDates) are hatched and skipped; a typed date that has no
// data snaps to the closest one that does and says so. All values are UTC-midnight timestamps.
//
// The map only re-renders on commit (pointer up, Enter, or 250 ms after the last scroll or key),
// inside a React transition, so dragging and scrolling stay smooth. Dots marked `follow` move with
// the bar immediately; the map catches up on commit.
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DAY_MS,
  findDateGaps,
  formatLongDate,
  formatShortDate,
  parseDateInput,
  snapOnOrBefore,
  snapToAvailable,
  stepDate,
  toUtcDay,
  type TimelineDateRange,
} from "@/lib/timeline";

export type DateTimelineProps = {
  mode: "single" | "range";
  /** First and last selectable day */
  min: number;
  max: number;
  /** Selected day (start === end) or span */
  value: TimelineDateRange;
  onCommit: (range: TimelineDateRange) => void;
  /** Sorted days that hold data; omit when every day in [min, max] is valid */
  availableDates?: number[];
  /** What the dates belong to, e.g. "Air Temperature, Cloud Cover" */
  title?: string;
  /** Positioning (the card look is built in) */
  className?: string;
  /** Coloured dots under the ruler, one per dataset at the date it shows (single mode) */
  markers?: TimelineMarker[];
  /** Clicking a dot, e.g. to make the ruler move only that dataset */
  onMarkerClick?: (id: string) => void;
  /** Colour of the selected-day bar (the focused dataset's colour) */
  accent?: string;
  /** Render only the control, without the card and header, inside a parent panel */
  embedded?: boolean;
  /** "No data" spans; computed from availableDates when omitted */
  gaps?: TimelineDateRange[];
  /** The bar's uncommitted day while it moves (null once committed), for live previews */
  onDraft?: (day: number | null) => void;
};

export type TimelineMarker = {
  id: string;
  date: number;
  color: string;
  label: string;
  active?: boolean;
  /** Where this dot lands for a given bar position, so it moves with the bar (to days it really
   *  has) while a change is in progress. Omit to keep the dot still. */
  predict?: (day: number) => number;
};

const VIEW_W = 1000; // SVG ruler coordinate width; stretched to the real width
const VIEW_H = 40;
const COMMIT_DELAY_MS = 250;
const WHEEL_NOTCH_PX = 100;
const STACK_WITHIN_PCT = 2.5; // dots closer than this share a stack
const DOT_ROW_PX = 14; // fixed height of the dot row; stacks never make the panel taller
const DOT_MAX_SPREAD_PX = 4; // a whole stack spreads at most this far
const MAX_TICK_PER_DATE = 180; // above this, ticks fall on calendar boundaries instead

const clamp = (t: number, min: number, max: number) => Math.min(max, Math.max(min, t));
const todayUtc = () => toUtcDay(Date.now());

/** Tick positions: one per available date when few, else days, months or years by span. */
function buildTicks(min: number, max: number, available: number[] | undefined, gaps: TimelineDateRange[]) {
  if (available && available.length <= MAX_TICK_PER_DATE) return { ticks: available, yearly: false };
  const days = (max - min) / DAY_MS;
  const ticks: number[] = [];
  const start = new Date(min);
  if (days <= 120) {
    for (let t = min; t <= max; t += DAY_MS) ticks.push(t);
  } else if (days <= 365 * 4) {
    for (let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1; ; m++) {
      const t = Date.UTC(y, m, 1);
      if (t > max) break;
      ticks.push(t);
    }
  } else {
    const every = days > 365 * 120 ? 10 : days > 365 * 60 ? 5 : 1;
    const first = Math.ceil((start.getUTCFullYear() + 1) / every) * every;
    for (let y = first; Date.UTC(y, 0, 1) <= max; y += every) ticks.push(Date.UTC(y, 0, 1));
  }
  const inGap = (t: number) => gaps.some((g) => t >= g.start && t <= g.end);
  return { ticks: ticks.filter((t) => !inGap(t)), yearly: days > 365 * 4 };
}

/** A date that reads as text and becomes a text box when clicked. */
function DateField({
  value,
  onSubmit,
  label,
  format = formatShortDate,
  className = "",
}: {
  value: number;
  onSubmit: (t: number) => void;
  label: string;
  format?: (t: number) => string;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null); // null = not editing
  const [invalid, setInvalid] = useState(false);
  const submit = (el: HTMLInputElement) => {
    if (text === null) return;
    const t = parseDateInput(text);
    if (t === null) {
      setInvalid(true);
      return;
    }
    setText(null);
    setInvalid(false);
    if (t !== value) onSubmit(t);
    el.blur();
  };
  return (
    <input
      type="text"
      aria-label={label}
      aria-invalid={invalid}
      title="Type a date, e.g. 2026-01-10 or Jan 10 2026"
      value={text ?? format(value)}
      size={Math.max(8, (text ?? format(value)).length)}
      onFocus={(e) => {
        setText(format(value));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        setText(e.target.value);
        setInvalid(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit(e.currentTarget);
        if (e.key === "Escape") {
          setText(null);
          setInvalid(false);
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        if (text !== null && parseDateInput(text) !== null) submit(e.currentTarget);
        else {
          setText(null);
          setInvalid(false);
        }
      }}
      className={`rounded border bg-transparent px-1 text-center font-semibold text-white outline-none transition-colors hover:border-white/30 focus:border-sky-400 focus:bg-white/5 ${
        invalid ? "border-red-400" : "border-transparent"
      } ${className}`}
    />
  );
}

export default function DateTimeline({
  mode,
  min,
  max,
  value,
  onCommit,
  availableDates,
  title,
  className = "",
  markers,
  onMarkerClick,
  accent = "#38bdf8",
  embedded = false,
  gaps: gapsOverride,
  onDraft,
}: DateTimelineProps) {
  const [draft, setDraft] = useState(value);
  const [note, setNote] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<number>();
  const draftRef = useRef(draft);
  const span = max - min || 1;

  useEffect(() => {
    draftRef.current = value;
    setDraft(value);
  }, [value.start, value.end]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const moving = draft.end !== value.end;
  useEffect(() => onDraft?.(moving ? draft.end : null), [moving, draft.end]);
  // A note (typed date had no data) replaces the edge labels for a few seconds, so no space is
  // reserved for it and the panel never changes height
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 5000);
    return () => window.clearTimeout(t);
  }, [note]);

  const gaps = useMemo(() => gapsOverride ?? findDateGaps(availableDates, min, max), [gapsOverride, availableDates, min, max]);
  const pct = (t: number) => ((clamp(t, min, max) - min) / span) * 100;
  const fit = (t: number) => clamp(snapToAvailable(availableDates, clamp(toUtcDay(t), min, max)), min, max);

  const commit = (range: TimelineDateRange) => {
    window.clearTimeout(timer.current);
    if (range.start !== value.start || range.end !== value.end) startTransition(() => onCommit(range));
  };
  const commitSoon = (range: TimelineDateRange) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(range), COMMIT_DELAY_MS);
  };
  const setSingle = (t: number, when: "now" | "soon" | "draft") => {
    const r = { start: t, end: t };
    draftRef.current = r; // read by rapid wheel and key events before React re-renders
    setDraft(r);
    if (when === "now") commit(r);
    if (when === "soon") commitSoon(r);
  };
  /** Typed dates: the latest day with data on or before it (Mar 20 on a monthly layer is March). */
  const typed = (t: number) => {
    const fitted = clamp(snapOnOrBefore(availableDates, clamp(toUtcDay(t), min, max)), min, max);
    setNote(
      fitted !== toUtcDay(t)
        ? t < min || t > max
          ? `${formatShortDate(t)} is outside ${formatShortDate(min)} to ${formatShortDate(max)}; showing ${formatShortDate(fitted)}.`
          : `No data on ${formatShortDate(t)}; showing ${formatShortDate(fitted)}.`
        : null,
    );
    return fitted;
  };

  const reset = () => {
    setNote(null);
    const r = mode === "single" ? { start: fit(max), end: fit(max) } : { start: min, end: max };
    setDraft(r);
    commit(r);
  };
  const atDefault =
    mode === "single" ? value.end === fit(max) : value.start === min && value.end === max;

  // ---- single mode: ruler ----
  const ruler = useRef<SVGSVGElement>(null);
  const { ticks, yearly } = useMemo(() => buildTicks(min, max, availableDates, gaps), [min, max, availableDates, gaps]);
  const selX = (pct(draft.end) / 100) * VIEW_W;
  const tickPath = useMemo(() => {
    let d = "";
    for (const t of ticks) {
      const x = ((t - min) / span) * VIEW_W;
      const near = Math.exp(-(((x - selX) / 110) ** 2)); // taller close to the selection
      const isYear = !yearly && new Date(t).getUTCMonth() === 0 && new Date(t).getUTCDate() === 1;
      const h = 9 + 19 * near + (isYear ? 5 : 0);
      d += `M${x.toFixed(1)} ${VIEW_H}V${(VIEW_H - h).toFixed(1)}`;
    }
    return d;
  }, [ticks, min, span, selX, yearly]);

  const fromPointer = (clientX: number) => {
    const rect = ruler.current!.getBoundingClientRect();
    return fit(min + ((clientX - rect.left) / rect.width) * span);
  };

  // Scrolling over the ruler steps through dates. Native listener: React's wheel handler is
  // passive and could not stop the page or map from scrolling too.
  useEffect(() => {
    const el = ruler.current;
    if (!el || mode !== "single") return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // One mouse-wheel notch (about 100 px) = one date; trackpads accumulate small deltas
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      acc += e.deltaMode === 1 ? delta * 33 : e.deltaMode === 2 ? delta * 400 : delta;
      const notches = Math.trunc(acc / WHEEL_NOTCH_PX);
      if (!notches) return;
      acc -= notches * WHEEL_NOTCH_PX;
      const jump = e.shiftKey ? (availableDates ? 10 : 30) : 1;
      setNote(null);
      setSingle(stepDate(availableDates, draftRef.current.end, notches * jump, min, max), "soon");
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const big = availableDates ? 10 : 30;
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -big, PageUp: big };
    let t: number | null = null;
    if (e.key in steps) t = stepDate(availableDates, draft.end, steps[e.key], min, max);
    if (e.key === "Home") t = fit(min);
    if (e.key === "End") t = fit(max);
    if (t === null) return;
    e.preventDefault();
    setNote(null);
    setSingle(t, "soon");
  };

  const header = (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {title && (
          <p className="truncate text-xs text-white/60" title={title}>
            {title}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={reset}
        className="shrink-0 text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50"
        disabled={atDefault}
      >
        {mode === "single" ? "Latest" : "Reset"}
      </button>
    </div>
  );

  const gapBands = (
    <>
      {gaps.map((g) => (
        <div
          key={g.start}
          aria-hidden="true"
          className="absolute inset-y-0"
          style={{
            left: `${pct(g.start)}%`,
            width: `${Math.max(0.4, pct(g.end + DAY_MS) - pct(g.start))}%`,
            background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 5px)",
          }}
        />
      ))}
    </>
  );

  const footer = (
    <>
      <div className="mt-1 flex h-4 items-center justify-between text-[10px] text-white/50">
        {note ? (
          <p role="status" className="truncate text-[11px] text-amber-200" title={note}>
            {note}
          </p>
        ) : (
        <>
        <span>{formatShortDate(min)}</span>
        {gaps.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 4px)" }}
            />
            No data
          </span>
        )}
        <span>{max === todayUtc() ? "Today" : formatShortDate(max)}</span>
        </>
        )}
      </div>
    </>
  );

  const card = embedded
    ? className
    : `rounded-lg border border-white/15 bg-[#0c1022]/95 p-4 text-white shadow-2xl backdrop-blur ${className}`;
  const Wrapper = embedded ? "div" : "aside";

  // Dots: datasets showing the same day, or days too close to tell apart on this ruler, stack
  // into a short column instead of hiding each other
  const markerGroups = useMemo(() => {
    // While a change is in progress each predicting dot sits on the day its dataset would show, so
    // it steps with the bar only to days that dataset has; once committed, dots show real days
    const placed = (markers ?? []).map((m) => (m.predict && moving ? { ...m, date: m.predict(draft.end) } : m));
    const sorted = placed.sort((a, b) => a.date - b.date);
    const groups: TimelineMarker[][] = [];
    for (const m of sorted) {
      const last = groups[groups.length - 1];
      if (last && pct(m.date) - pct(last[0].date) < STACK_WITHIN_PCT) last.push(m);
      else groups.push([m]);
    }
    return groups.map((g): [number, TimelineMarker[]] => [g[0].date, g]);
  }, [markers, min, max, draft.end, moving]);

  if (mode === "single") {
    const disabled = min === max;
    return (
      <Wrapper aria-label={embedded ? undefined : "Data timeline"} className={card}>
        {!embedded && header}
        <div className="relative pt-7">
          {/* the selected date sits above its bar and can be typed into */}
          <div
            className="absolute top-0 -translate-x-1/2 text-xs"
            style={{ left: `clamp(4.5rem, ${pct(draft.end)}%, calc(100% - 4.5rem))` }}
          >
            <DateField
              label="Selected data date"
              value={draft.end}
              format={formatLongDate}
              onSubmit={(t) => setSingle(typed(t), "now")}
            />
          </div>
          <div className="relative h-10">
            {gapBands}
            <svg
              ref={ruler}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label="Data date"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={draft.end}
              aria-valuetext={formatLongDate(draft.end)}
              aria-disabled={disabled}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full cursor-ew-resize touch-none rounded outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
              onKeyDown={onKeyDown}
              onBlur={() => commit(draftRef.current)}
              onPointerDown={(e) => {
                if (disabled) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setNote(null);
                setSingle(fromPointer(e.clientX), "draft");
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) setSingle(fromPointer(e.clientX), "draft");
              }}
              onPointerUp={() => commit(draftRef.current)}
              onPointerCancel={() => commit(draftRef.current)}
            >
              <path d={tickPath} stroke="rgba(255,255,255,0.45)" strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />
              <line
                x1={selX}
                x2={selX}
                y1={0}
                y2={VIEW_H}
                stroke={accent}
                strokeWidth={4}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          {markerGroups.length > 0 && (
            <div className="relative mt-1" style={{ height: DOT_ROW_PX }}>
              {markerGroups.map(([date, group]) => {
                const step = group.length > 1 ? Math.min(3, DOT_MAX_SPREAD_PX / (group.length - 1)) : 0;
                return (
                <div
                  key={group[0].id}
                  className="absolute top-0 -translate-x-1/2"
                  style={{ left: `${pct(date)}%`, width: 10, height: DOT_ROW_PX }}
                >
                  {group.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={`${m.label}: ${formatShortDate(m.date)}`}
                      title={`${m.label}: ${formatShortDate(m.date)}`}
                      onClick={() => onMarkerClick?.(m.id)}
                      className={`absolute left-0 h-2.5 w-2.5 rounded-full border border-[#0c1022] transition-transform hover:scale-125 ${
                        m.active ? "ring-1 ring-white/80" : ""
                      }`}
                      style={{ top: i * step, background: m.color, zIndex: group.length - i }}
                    />
                  ))}
                </div>
                );
              })}
            </div>
          )}
        </div>
        {footer}
      </Wrapper>
    );
  }

  // ---- range mode: same look as the existing oil spills timeline, plus typed dates ----
  const disabled = min === max;
  const setStart = (t: number) => {
    const r = { start: Math.min(t, draftRef.current.end), end: draftRef.current.end };
    draftRef.current = r;
    setDraft(r);
    return r;
  };
  const setEnd = (t: number) => {
    const r = { start: draftRef.current.start, end: Math.max(t, draftRef.current.start) };
    draftRef.current = r;
    setDraft(r);
    return r;
  };
  const release = () => commit(draftRef.current);
  return (
    <Wrapper aria-label={embedded ? undefined : "Data timeline"} className={card}>
      {!embedded && header}
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-white/80">
        <span className="flex items-center gap-1 whitespace-nowrap">
          From <DateField label="Earliest displayed date" value={draft.start} onSubmit={(t) => commit(setStart(typed(t)))} />
        </span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          Through <DateField label="Latest displayed date" value={draft.end} onSubmit={(t) => commit(setEnd(typed(t)))} />
        </span>
      </div>
      <div className="relative my-2 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
          {gapBands}
        </div>
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-sky-400"
          style={{ left: `${pct(draft.start)}%`, right: `${100 - pct(draft.end)}%` }}
        />
        {(["start", "end"] as const).map((side) => (
          <input
            key={side}
            aria-label={side === "start" ? "Earliest displayed date" : "Latest displayed date"}
            type="range"
            min={min}
            max={max}
            step={DAY_MS}
            value={draft[side]}
            disabled={disabled}
            onChange={(e) => {
              setNote(null);
              const t = fit(Number(e.target.value));
              if (side === "start") setStart(t);
              else setEnd(t);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onKeyUp={release}
            onBlur={release}
            className="timeline-range-input"
          />
        ))}
      </div>
      {footer}
    </Wrapper>
  );
}
