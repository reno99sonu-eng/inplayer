// Single source of truth for the multi-language caption set. Both the Mux
// webhook (new uploads) and the admin backfill (already-published videos)
// build captions through here, so the two can never drift apart.
import { translateVtt, cleanupVtt } from "./translate";

// The caption languages every video should end up with.
export const CAPTION_TARGETS: Array<{
  code: string;
  name: string;
  label: string;
}> = [
  { code: "en", name: "English", label: "English" },
  { code: "hi", name: "Hindi", label: "हिन्दी" },
  { code: "bn", name: "Bengali", label: "বাংলা" },
  { code: "ta", name: "Tamil", label: "தமிழ்" },
  { code: "te", name: "Telugu", label: "తెలుగు" },
  { code: "mr", name: "Marathi", label: "मराठी" },
  { code: "gu", name: "Gujarati", label: "ગુજરાતી" },
  { code: "kn", name: "Kannada", label: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", label: "മലയാളം" },
  { code: "pa", name: "Punjabi", label: "ਪੰਜਾਬੀ" },
  { code: "or", name: "Odia", label: "ଓଡ଼ିଆ" },
];

// Collapses a Mux-detected BCP-47 code down to its base language, folding
// in known ASR mix-ups. Mux's speech-to-text has no Hindi model, so "auto"
// detection on Hindi audio very often comes back tagged "ur" (Urdu) — the
// closest-sounding language Mux's detector actually knows — even though
// this app has never offered, and doesn't want, Urdu captions. Collapse
// that back to Hindi so it never surfaces as a caption-menu entry.
export function normalizeLangCode(code: unknown): string {
  const base = String(code || "").split("-")[0].toLowerCase();
  if (base === "ur") return "hi";
  return base;
}

// Resolves the true spoken language of a video: the creator's own declared
// value (set at upload) is always trusted over Mux's "auto" guess when we
// have it, because Mux has no ASR model for Hindi/Bengali and its guess for
// those is regularly wrong. Mux's detected code is only a fallback for
// videos uploaded before the upload-time field existed.
export function resolveSourceLang(
  declared: unknown,
  detectedRaw: unknown
): string {
  if (declared && declared !== "auto") return String(declared);
  return normalizeLangCode(detectedRaw);
}

import { splitLongVttCues } from "./vttChunker";

// Turns a single raw source-language VTT into the full regional languages set.
export async function buildCaptionSet(
  rawSourceVtt: string,
  sourceLang: string
): Promise<Record<string, string>> {
  const sourceTarget = CAPTION_TARGETS.find((t) => t.code === sourceLang);

  // Chunk long cues into short 1-line/2-line YouTube-style subtitle items
  let sourceVtt = splitLongVttCues(rawSourceVtt);

  if (sourceTarget && (sourceLang === "hi" || sourceLang === "bn")) {
    const cleaned = await cleanupVtt(sourceVtt, sourceTarget.name);
    if (cleaned) sourceVtt = splitLongVttCues(cleaned);
  }

  const out: Record<string, string> = {};
  if (sourceTarget) out[sourceTarget.code] = sourceVtt;

  const targets = CAPTION_TARGETS.filter((t) => t.code !== sourceLang);
  const results = await Promise.all(
    targets.map((t) => translateVtt(sourceVtt, t.name))
  );
  targets.forEach((t, i) => {
    const translated = results[i];
    if (translated) out[t.code] = splitLongVttCues(translated);
  });

  return out;
}
