// Live "where would each dataset land" while the timeline bar is being dragged, scrolled or
// stepped, before the map commits. Plain pub/sub so legends can update their date text directly,
// without re-rendering React or reloading tiles on every pointer move.
export type TimelinePreview = Record<string, number> | null; // dataset id -> UTC day; null = no change in progress

type Listener = (preview: TimelinePreview) => void;
const listeners = new Set<Listener>();
let current: TimelinePreview = null;

export function publishTimelinePreview(preview: TimelinePreview) {
  current = preview;
  listeners.forEach((listener) => listener(preview));
}

export function subscribeTimelinePreview(listener: Listener) {
  listeners.add(listener);
  if (current) listener(current);
  return () => {
    listeners.delete(listener);
  };
}
