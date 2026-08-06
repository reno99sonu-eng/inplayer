// Shared, app-wide "only one hover/scroll preview may stream at a time"
// gate for HomeVideoCard (see RecommendationFeed.tsx).
//
// Why this exists: each HomeVideoCard used to decide its OWN preview state
// independently — a mouse-hover timer on desktop, or an IntersectionObserver
// on touch devices (phones/tablets/touch laptops, anywhere
// `matchMedia("(hover: hover) and (pointer: fine)")` is false). On a
// multi-column grid, several cards can cross the 60%-visible threshold in
// the very same instant a page finishes loading — and since nothing
// coordinated between cards, EVERY one of them would independently start
// streaming its own muted preview clip at once. Each preview mounts a full
// Mux HLS player that immediately buffers multiple video segments (still
// 500KB-1.5MB apiece), so a handful of cards going live together means
// several megabytes of concurrent video downloading and decoding the
// instant the homepage appears — enough to pin a phone's (or even a
// touch-enabled laptop's) main thread and network so hard that the rest of
// the page, including the splash curtain's own dismiss timer, never gets a
// turn to run. That is what was surfacing as "stuck on the loading logo."
//
// This is a plain module-level singleton (not React state/context) on
// purpose: HomeVideoCard is rendered from more than one independent parent
// tree (the homepage feed in RecommendationFeed.tsx, and a channel's own
// video grid in app/u/[username]/page.tsx), so the "only one preview at a
// time" rule needs to hold across the whole app, not just within one
// parent's subtree — a React context would only coordinate cards that share
// the same provider.
type Listener = (activeId: symbol | null) => void;

let activeId: symbol | null = null;
const listeners = new Set<Listener>();

export function getActivePreviewId(): symbol | null {
  return activeId;
}

export function subscribeToActivePreview(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Claims the single preview slot for `id`, bumping whichever card previously
// held it (that card's own subscription callback flips its `previewing` to
// false on the very next render — no explicit "stop" call needed on its
// end).
export function requestActivePreview(id: symbol): void {
  if (activeId === id) return;
  activeId = id;
  listeners.forEach((listener) => listener(activeId));
}

// Releases the slot, but ONLY if `id` is the card that currently holds it —
// this makes it safe for a card to call release on its own hover-out/
// scroll-out/unmount without accidentally clearing a different card that
// has since claimed the slot.
export function releaseActivePreview(id: symbol): void {
  if (activeId !== id) return;
  activeId = null;
  listeners.forEach((listener) => listener(activeId));
}
