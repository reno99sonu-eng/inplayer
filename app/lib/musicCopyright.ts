// Copyright screening for music uploads.
//
// READ THIS BEFORE CHANGING ANYTHING HERE, because the honest limits matter
// more than the code:
//
// NO SOFTWARE CAN LISTEN TO A SONG AND KNOW IT IS COPYRIGHTED. When YouTube
// catches a commercial track, Content ID is not reasoning about it — it is
// matching an audio FINGERPRINT against a licensed reference database of
// recordings that rights holders handed over. Without that database there
// is nothing to compare against, and no amount of model cleverness
// substitutes for it. An LLM reading a title cannot hear the audio.
//
// So this file does the three things that ARE genuinely possible without a
// licensed catalogue, and leaves a clearly-marked seam for the fourth:
//
//   1. OWNERSHIP DECLARATION (declaredOwnership) — the creator states the
//      recording is theirs. Recorded with a timestamp and IP. This is not
//      theatre: it is the thing that actually gives InPlayer its safe
//      harbour when a rights holder complains, and it is what every
//      platform in the world ultimately relies on.
//
//   2. EXACT-DUPLICATE DETECTION (audioSha256) — a hash of the audio bytes,
//      computed in the browser before upload. Catches anyone re-uploading a
//      file already on InPlayer, including their own previous upload, for
//      free and with certainty. It cannot catch a re-encode, a trim, or a
//      recording of a recording — a single changed byte changes the hash.
//
//   3. METADATA SCREENING (screenMusicMetadata, below) — reads what the
//      creator TYPED, not what they uploaded. This catches naive
//      infringement well, because people who upload someone else's song
//      overwhelmingly announce it in the title: "Official Audio", "Full
//      Song", "Lyrical Video", a film name, a label name. It cannot catch
//      someone who uploads a stolen track under an innocuous title, and it
//      will occasionally suspect a genuine creator whose own song happens
//      to be called "Cover" — which is exactly why a hit FLAGS FOR ADMIN
//      REVIEW and never blocks or hides. A false positive must never stop a
//      real musician publishing their own work.
//
//   4. THE MISSING PIECE — fingerprinting against commercial catalogues.
//      See ExternalFingerprintProvider at the bottom. Wiring in ACRCloud or
//      AcoustID later is implementing one interface and setting one env
//      var; nothing else in the pipeline changes.
//
// THIS FILE IS PURE — no network, no AWS, no next/* — so every rule below
// is directly testable, and the same rules run on the server and (for
// instant feedback) in the upload form.

export type CopyrightRisk = "clear" | "review";

/**
 * The `reporterId` on a copyright report raised by this screening rather
 * than by a person.
 *
 * A flagged track is filed into the SAME queue a rights holder's complaint
 * goes to (InPlayer-Reports, reason "copyright") so that one place decides
 * copyright on InPlayer — but a reviewer must be able to tell at a glance
 * that nobody actually complained yet. A machine's suspicion and a rights
 * holder's claim deserve very different weight, and collapsing them is how
 * a real musician ends up struck for a title that merely read wrong.
 */
export const COPYRIGHT_SCREEN_REPORTER = "system:copyright-screen";

export interface CopyrightSignal {
  /** Stable id, so the admin queue can group and count them. */
  code: string;
  /** Shown to the admin reviewing the track. Written to be read by a human
   *  deciding a real person's case, not as a debug string. */
  detail: string;
}

export interface CopyrightScreening {
  risk: CopyrightRisk;
  signals: CopyrightSignal[];
}

// Phrases that essentially only appear on a re-upload of someone else's
// commercial release. A creator posting their OWN song does not label it
// "official audio" — that is the language of a record label's channel, and
// of the people who rip from it.
//
// Deliberately NOT included: "remix", "mashup", "instrumental", "karaoke".
// Those are real, common, often perfectly licensed original works, and
// flagging them would bury the queue in legitimate creators. Judgement here
// is about precision, not coverage — a noisy queue gets ignored, and an
// ignored queue protects nobody.
const RELEASE_MARKERS: { pattern: RegExp; code: string; detail: string }[] = [
  {
    pattern: /\bofficial\s+(audio|song|track|music\s*video|video)\b/i,
    code: "official_release_wording",
    detail: '"Official audio/video" is label wording — creators posting their own song rarely use it.',
  },
  {
    pattern: /\b(lyrical|lyric)\s+video\b/i,
    code: "lyrical_video_wording",
    detail: '"Lyrical video" is a standard commercial-release label.',
  },
  {
    pattern: /\bfull\s+(song|audio|movie\s*song|video\s*song)\b/i,
    code: "full_song_wording",
    detail: '"Full song" is typical of a rip from a commercial release.',
  },
  {
    pattern: /\b(audio\s*jukebox|jukebox)\b/i,
    code: "jukebox_wording",
    detail: '"Jukebox" is an album-compilation format published by labels.',
  },
  {
    pattern: /\b(from\s+the\s+(movie|film)|movie\s+song|film\s+version)\b/i,
    code: "film_soundtrack_wording",
    detail: "Described as being from a film — film soundtracks are owned by the production house or label.",
  },
  {
    pattern: /\b(t[\s-]?series|zee\s*music|sony\s*music|saregama|yrf|tips\s*(music|official)|speed\s*records|aditya\s*music|lahari|eros\s*now|universal\s*music|warner\s*music)\b/i,
    code: "label_named",
    detail: "A record label is named in the metadata. Labels own their masters.",
  },
  {
    pattern: /\b(cover\s+(of|version|song)|sung\s+by\s+me|my\s+cover)\b/i,
    code: "cover_wording",
    detail: "Described as a cover. A cover of someone else's composition needs a licence even when the performance is original.",
  },
  {
    // NOTE the shape of this one. It was originally written as
    // /\b(copyright|©|...)\b/i and that rule could NEVER fire on "©":
    // \b asserts a word/non-word boundary, and © is a non-word character,
    // so \b© demands a word character immediately before the symbol. A
    // string starting "© 2024 Sony" has nothing before it and never
    // matched. Word-ish alternatives keep their own \b; the symbol must
    // not have one.
    pattern: /(?:\bcopyright\b|©|\(c\)\s*\d{4}|\ball\s+rights\s+reserved\b)/i,
    code: "copyright_notice",
    detail: "Carries a copyright notice, which usually credits somebody other than the uploader.",
  },
  {
    pattern: /\b(no\s+copyright\s+(intended|infringement)|for\s+(promotional|entertainment)\s+purpose)\b/i,
    code: "disclaimer_wording",
    detail: '"No copyright intended" is an admission, not a defence — it reliably marks a knowing re-upload.',
  },
];

/**
 * Screens what the creator typed. Never sees or hears the audio.
 *
 * `declaredOwnership === false` is on its own enough to send a track to
 * review: if the uploader will not state the song is theirs, nothing else
 * needs deciding.
 */
export function screenMusicMetadata(input: {
  title?: unknown;
  description?: unknown;
  tags?: unknown;
  declaredOwnership?: unknown;
}): CopyrightScreening {
  const signals: CopyrightSignal[] = [];

  if (input.declaredOwnership !== true) {
    signals.push({
      code: "ownership_not_declared",
      detail: "The uploader did not confirm they own this recording.",
    });
  }

  const parts: string[] = [];
  if (typeof input.title === "string") parts.push(input.title);
  if (typeof input.description === "string") parts.push(input.description);
  if (Array.isArray(input.tags)) {
    for (const tag of input.tags) if (typeof tag === "string") parts.push(tag);
  }
  const haystack = parts.join(" \n ");

  if (haystack.trim()) {
    for (const marker of RELEASE_MARKERS) {
      if (marker.pattern.test(haystack)) {
        signals.push({ code: marker.code, detail: marker.detail });
      }
    }
  }

  return { risk: signals.length > 0 ? "review" : "clear", signals };
}

/** Merges the metadata screen with the two other checks the server can run:
 *  an exact byte-for-byte match against something already on InPlayer, and
 *  (once configured) an external fingerprint hit. */
export function combineCopyrightSignals(params: {
  metadata: CopyrightScreening;
  duplicateOfVideoId?: string | null;
  externalMatch?: ExternalFingerprintMatch | null;
}): CopyrightScreening {
  const signals = [...params.metadata.signals];

  if (params.duplicateOfVideoId) {
    signals.push({
      code: "exact_duplicate",
      detail: `Byte-for-byte identical to a track already on InPlayer (${params.duplicateOfVideoId}).`,
    });
  }

  if (params.externalMatch) {
    signals.push({
      code: "external_fingerprint_match",
      detail: `Audio fingerprint matched a known commercial recording: "${params.externalMatch.title}" by ${params.externalMatch.artist}${
        params.externalMatch.label ? ` (${params.externalMatch.label})` : ""
      }.`,
    });
  }

  return { risk: signals.length > 0 ? "review" : "clear", signals };
}

/** A one-line summary for the admin queue's list view. */
export function copyrightSummary(screening: CopyrightScreening): string {
  if (screening.risk === "clear") return "No copyright signals";
  if (screening.signals.length === 1) return screening.signals[0].detail;
  return `${screening.signals.length} copyright signals — ${screening.signals[0].detail}`;
}

// ── The seam for real fingerprinting ──────────────────────────────────
//
// Implement this against ACRCloud (paid, strong Indian film/label coverage)
// or AcoustID/MusicBrainz (free, thinner on Indian music) and register it;
// combineCopyrightSignals already knows what to do with the result. Nothing
// else in the upload pipeline changes.
//
// Deliberately NOT implemented behind a fake: a stub that always returns
// null would look like working protection in every code path and every
// test, right up until a real infringing track sailed through. An absent
// provider is honest — the admin queue can say "external checking is off".

export interface ExternalFingerprintMatch {
  title: string;
  artist: string;
  label?: string;
  /** 0→1 from the provider. */
  confidence: number;
}

export interface ExternalFingerprintProvider {
  name: string;
  /** Given a playable URL for the uploaded audio, return a match or null. */
  identify(audioUrl: string): Promise<ExternalFingerprintMatch | null>;
}

let provider: ExternalFingerprintProvider | null = null;

export function registerFingerprintProvider(p: ExternalFingerprintProvider) {
  provider = p;
}

export function getFingerprintProvider(): ExternalFingerprintProvider | null {
  return provider;
}

/** True when external catalogue checking is actually switched on. The admin
 *  queue shows this, so a reviewer knows whether "no external match" means
 *  "checked and clean" or "never checked". Conflating those two is how a
 *  reviewer ends up trusting a check that never ran. */
export function externalCheckingEnabled(): boolean {
  return provider !== null;
}
