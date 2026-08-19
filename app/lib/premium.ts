// InPlayer Premium — the platform-wide viewer tier.
//
// Before this there was NO platform-wide paid concept at all. The only paid
// thing in the codebase is per-creator membership (app/lib/memberships.ts),
// which unlocks one creator's members-only videos and is unrelated to this.
// "Subscriptions" elsewhere in the app means a free follow, not a paid plan.
//
// THIS FILE IS PURE — no DynamoDB, no next/headers — so both the server
// routes and the client components (the Playback settings, the Plans card)
// can import the same rules and can't drift apart on what Premium means.
//
// Billing is not wired up yet: nothing charges anyone. `premiumUntil` on the
// user's row is the single source of truth, and today it is set by hand (or
// by a future Razorpay webhook, exactly the way per-creator membership
// already works in app/api/webhooks/razorpay). That's deliberate — the tier
// and its enforcement are real and testable now, and turning billing on
// later only has to write that one field.

// The values Mux Player's `maxResolution` prop actually accepts. Verified
// against the installed package, not assumed:
//   @mux/playback-core/dist/types/types.d.ts →
//     MaxResolution = { upTo720p: "720p", upTo1080p: "1080p",
//                       upTo1440p: "1440p", upTo2160p: "2160p" }
//
// NOTE there is deliberately no 480p or 540p here even though Mux encodes
// those renditions. They are valid MIN resolutions but not valid MAX ones —
// passing "480p" as a cap is rejected by the player, which would silently
// leave that choice uncapped. An earlier version of this file offered 480p
// in the quality menu for exactly that reason; don't add it back.
export type PlaybackResolution = "720p" | "1080p" | "1440p" | "2160p";

/** What a viewer picked in Settings — a real cap, or "let the tier decide". */
export type QualityChoice = PlaybackResolution | "auto";

/** Ordered worst → best, so a cap can be compared numerically. */
export const RESOLUTION_ORDER: PlaybackResolution[] = [
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

/** The ceiling a free viewer can ever reach, whatever they pick in Settings.
 *  1080p is a real, complete viewing experience — the paid upgrade is 1440p
 *  and 4K, not "watchable vs unwatchable". */
export const FREE_MAX_RESOLUTION: PlaybackResolution = "1080p";

/** Premium's ceiling: the best rendition Mux produced for the asset. */
export const PREMIUM_MAX_RESOLUTION: PlaybackResolution = "2160p";

export function isResolutionAtLeast(
  candidate: PlaybackResolution,
  floor: PlaybackResolution
): boolean {
  return RESOLUTION_ORDER.indexOf(candidate) >= RESOLUTION_ORDER.indexOf(floor);
}

/** True if this resolution needs Premium — i.e. it exceeds the free ceiling. */
export function requiresPremium(resolution: PlaybackResolution): boolean {
  return RESOLUTION_ORDER.indexOf(resolution) > RESOLUTION_ORDER.indexOf(FREE_MAX_RESOLUTION);
}

// The one place that decides what a given viewer may stream.
//
// `preferred` is whatever they chose in Settings > Playback (null = "Auto",
// meaning "as good as I'm allowed"). The answer is always the LOWER of what
// they asked for and what their tier permits — so a free viewer who
// previously selected 4K, or who hand-edits localStorage, still gets 1080p.
// The real enforcement is that this value is passed to the Mux player as its
// maximum rendition, so the higher renditions are never requested at all.
export function effectiveMaxResolution(
  isPremium: boolean,
  preferred?: PlaybackResolution | null
): PlaybackResolution {
  const tierCeiling = isPremium ? PREMIUM_MAX_RESOLUTION : FREE_MAX_RESOLUTION;
  if (!preferred) return tierCeiling;

  return RESOLUTION_ORDER.indexOf(preferred) < RESOLUTION_ORDER.indexOf(tierCeiling)
    ? preferred
    : tierCeiling;
}

/** Reads a user row's Premium state. Fails CLOSED — anything unparseable,
 *  missing or expired is simply not Premium. */
export function isPremiumFromRecord(
  item: { premiumUntil?: unknown } | null | undefined,
  now: number
): boolean {
  const until = item?.premiumUntil;
  if (typeof until !== "string" || !until) return false;
  const expiry = new Date(until).getTime();
  return Number.isFinite(expiry) && expiry > now;
}

/** Options offered by the quality selects, with whether each needs Premium. */
export const QUALITY_OPTIONS: { value: QualityChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "1440p", label: "1440p (2K)" },
  { value: "2160p", label: "2160p (4K Ultra HD)" },
];

export function normalizeQuality(raw: unknown): QualityChoice {
  return QUALITY_OPTIONS.some((option) => option.value === raw)
    ? (raw as QualityChoice)
    : "auto";
}

/** Settings value → the `preferred` argument effectiveMaxResolution wants.
 *  "auto" (and anything unrecognised, including the old "Ultra HD (4K)" /
 *  "Auto" labels stored by the previous version of the settings UI) becomes
 *  null, i.e. "no preference, give me my tier's ceiling". Having this as its
 *  own function rather than an inline ternary at each call site is what
 *  keeps the union narrow enough for the compiler. */
export function preferredResolution(raw: unknown): PlaybackResolution | null {
  const choice = normalizeQuality(raw);
  return choice === "auto" ? null : choice;
}
