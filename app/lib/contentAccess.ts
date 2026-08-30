// Content access / audience control — the "real content-classification
// system" the Settings page's Restricted Mode and Child Mode toggles were
// waiting on (they shipped disabled and marked "Coming soon" precisely
// because per-video maturity ratings didn't exist yet).
//
// THIS FILE IS PURE. No next/headers, no DynamoDB, no cookies — so it can
// be imported from Client Components (the Settings toggles) and Server
// Components alike. Anything that needs to actually read the viewer's
// cookie lives in contentAccessServer.ts instead.
//
// Two independent concepts:
//
//   VideoAudience — what a creator tagged a video as, at upload time.
//     "everyone" (default) | "kids" | "adult"
//
//   AudienceMode — what the person watching has chosen to be shown.
//     "family" (default) | "all" | "kids"
//
// The default mode is "family": 18+ content is hidden until someone
// deliberately turns it on with their 6-digit passkey. That means a viewer
// who has never touched Settings — including every signed-out visitor —
// gets the safe view, and clearing cookies/site data returns them to the
// safe view rather than unlocking anything.

export type VideoAudience = "everyone" | "kids" | "adult";
export type AudienceMode = "all" | "family" | "kids";

/** Cookie holding the viewer's chosen mode. Set HttpOnly by the server
 *  (see app/api/content-access/route.ts) once the passkey is verified, so
 *  it can't be forged from the browser console or by a script. */
export const AUDIENCE_COOKIE = "inplayer-audience";

/** One year — this is a deliberate, passkey-protected choice, not a
 *  session preference, so it should survive browser restarts. */
export const AUDIENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Safe by default. Applies to signed-out visitors, first-time visitors,
 *  and anyone whose cookie is missing or unrecognised. */
export const DEFAULT_AUDIENCE_MODE: AudienceMode = "family";

export const PASSKEY_LENGTH = 6;

/** A passkey is exactly six digits — nothing else is accepted, on either
 *  the client or the server. */
export function isValidPasskey(value: unknown): value is string {
  return typeof value === "string" && new RegExp(`^\\d{${PASSKEY_LENGTH}}$`).test(value);
}

export function normalizeAudienceMode(raw: unknown): AudienceMode {
  return raw === "all" || raw === "kids" || raw === "family" ? raw : DEFAULT_AUDIENCE_MODE;
}

export function normalizeVideoAudience(raw: unknown): VideoAudience | null {
  return raw === "everyone" || raw === "kids" || raw === "adult" ? raw : null;
}

// What audience is this video actually in?
//
// Videos published before this feature existed have no `audience` field at
// all — only the older `ageRestricted` boolean. Those are read through that
// boolean instead of being dropped or defaulted wrongly, so nothing already
// live changes classification: an existing 18+ video stays 18+, and
// everything else becomes "everyone" (which is what it effectively was).
export function videoAudience(
  video: { audience?: unknown; ageRestricted?: unknown } | null | undefined
): VideoAudience {
  if (!video) return "everyone";

  const explicit = normalizeVideoAudience(video.audience);
  if (explicit) return explicit;

  return video.ageRestricted === true ? "adult" : "everyone";
}

// The single rule every surface in the app shares.
//
//   all    — everything, 18+ included. Requires the passkey to switch on.
//   family — everything EXCEPT 18+. The default.
//   kids   — ONLY content a creator explicitly tagged as Kids.
export function isVideoVisible(
  video: { audience?: unknown; ageRestricted?: unknown } | null | undefined,
  mode: AudienceMode
): boolean {
  const audience = videoAudience(video);

  if (mode === "all") return true;
  if (mode === "kids") return audience === "kids";
  return audience !== "adult";
}

export function filterByAudience<T extends { audience?: unknown; ageRestricted?: unknown }>(
  videos: T[],
  mode: AudienceMode
): T[] {
  // Fast path: "all" hides nothing, so skip the walk entirely on what is
  // the hottest list in the app.
  if (mode === "all") return videos;
  return videos.filter((video) => isVideoVisible(video, mode));
}

// The two Settings toggles Reno asked for, expressed over the single mode
// above so the two can never contradict each other (both on at once is not
// a state that exists).
export function modeFromToggles(showAdult: boolean, kidsOnly: boolean): AudienceMode {
  if (kidsOnly) return "kids";
  return showAdult ? "all" : "family";
}

export function togglesFromMode(mode: AudienceMode): { showAdult: boolean; kidsOnly: boolean } {
  return {
    showAdult: mode === "all",
    kidsOnly: mode === "kids",
  };
}

// Which mode changes actually need the 6-digit passkey.
//
// Only "all" does. It is the single mode that REVEALS something previously
// hidden (18+), so it is the only one worth locking. "family" and "kids"
// both narrow what is shown — a child flipping either of them can only ever
// see less than they could a moment ago, so demanding a code there buys no
// safety and just makes the control annoying to use.
//
// This is why the Kids switch in the hamburger has no passcode at all: both
// of its directions ("kids" on, "family" off) are non-loosening. Turning
// 18+ ON is the one action that stops and asks.
export function modeRequiresPasskey(mode: AudienceMode): boolean {
  void mode;
  return true;
}

// ── Backwards compatibility with the two older per-video flags ────────
//
// Before this, a video carried TWO independent booleans that could
// contradict each other: `madeForKids` (an Audience picker) and
// `ageRestricted` (a "Restrict to 18+" toggle) — nothing stopped a creator
// ticking both. `audience` replaces them as the single source of truth, and
// these two helpers keep the old fields written and readable so every
// existing consumer (the watch page's age gate, my-videos, the admin panel)
// keeps working untouched.

export function audienceFlags(audience: VideoAudience): {
  madeForKids: boolean;
  ageRestricted: boolean;
} {
  return {
    madeForKids: audience === "kids",
    ageRestricted: audience === "adult",
  };
}

/** Reads an older video's classification off the legacy flags. 18+ wins if
 *  both were somehow set, since that's the safer reading. */
export function audienceFromFlags(
  madeForKids: unknown,
  ageRestricted: unknown
): VideoAudience {
  if (ageRestricted === true) return "adult";
  if (madeForKids === true) return "kids";
  return "everyone";
}

export const AUDIENCE_OPTIONS: {
  value: VideoAudience;
  label: string;
  hint: string;
}[] = [
  { value: "everyone", label: "Everyone", hint: "Shown to all viewers" },
  { value: "kids", label: "Kids", hint: "Also appears in the Kids row" },
  { value: "adult", label: "18+", hint: "Hidden unless 18+ is unlocked" },
];

/** Human-readable label for the current mode, shown in Settings. */
export function audienceModeLabel(mode: AudienceMode): string {
  if (mode === "all") return "All content, including 18+";
  if (mode === "kids") return "Kids content only";
  return "Everything except 18+";
}
