import type { ModerationResult } from "./moderation";
import type { VideoAudience } from "./contentAccess";

// Automatic audience classification — the AI half of the content-access
// system (app/lib/contentAccess.ts). A creator picks Everyone / Kids / 18+
// at upload; this independently works out what the AI thinks it should be,
// and the two are compared.
//
// The point is NOT to second-guess honest creators. It's the one case that
// actually matters for a family-safety feature: content that carries adult
// signals being published as Kids, or as Everyone, where it would reach
// people who explicitly asked not to see it. That mismatch is the "unusual
// activity" worth flagging to an admin.
//
// COST: the primary signal is free. app/api/upload/create already calls
// moderateText() on every upload (OpenAI's Moderation API, free to call),
// so its category list is reused here rather than paying for a second
// model call. The keyword pass below is pure local string matching and
// costs nothing — it exists because the Moderation API is tuned for policy
// violations, not for age-appropriateness: "adults only, 18+ content
// inside" is not a policy violation, but it is unmistakably not for kids.

// Moderation categories that mean "adults only" on their own. These are
// OpenAI's own category keys (omni-moderation-latest).
const ADULT_MODERATION_CATEGORIES = [
  "sexual",
  "sexual/minors",
  "violence/graphic",
  "harassment/threatening",
  "hate/threatening",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
];

// Categories so severe that no amount of creator intent should keep the
// item publicly listed even for a moment — it goes straight to the admin
// queue, hidden, regardless of what the moderation API's overall `flagged`
// verdict was.
const ALWAYS_HIDE_CATEGORIES = ["sexual/minors"];

// Deliberately narrow and unambiguous. False positives here cost real
// creators reach, so this is not a general profanity list — every entry is
// a phrase whose presence in a title/description is a direct claim about
// the audience, not merely coarse language.
const ADULT_PHRASES = [
  "18+",
  "18 plus",
  "adults only",
  "adult only",
  "nsfw",
  "not safe for work",
  "xxx",
  "porn",
  "explicit content",
  "mature content",
  "uncensored",
];

const KIDS_PHRASES = [
  "for kids",
  "for children",
  "kids video",
  "nursery rhyme",
  "nursery rhymes",
  "toddler",
  "preschool",
  "kids song",
  "kids songs",
  "cartoon for kids",
  "bedtime story",
  "bedtime stories",
  "abc song",
  "learn colors",
  "learn numbers",
];

export interface AudienceClassification {
  /** What the AI believes this is. */
  suggested: VideoAudience;
  /** Human-readable reasons, stored on the item and shown to the admin. */
  signals: string[];
  /** True when the evidence is strong enough to override the creator. */
  strong: boolean;
  /** True when this must be hidden from listings immediately, whatever else. */
  mustHide: boolean;
}

function containsPhrase(haystack: string, phrases: string[]): string[] {
  return phrases.filter((phrase) => haystack.includes(phrase));
}

// `moderation` is whatever app/api/upload/create already got back from
// moderateText(). Pass UNCHECKED (or a result with checked:false) and this
// still works — it just falls back to the keyword pass alone, which is the
// correct fail-open behaviour when the moderation API is unreachable.
export function classifyAudience(
  text: string,
  moderation: ModerationResult
): AudienceClassification {
  const haystack = text.toLowerCase();
  const signals: string[] = [];

  const adultCategories = (moderation.categories || []).filter((category) =>
    ADULT_MODERATION_CATEGORIES.includes(category)
  );
  for (const category of adultCategories) {
    signals.push(`Moderation category: ${category}`);
  }

  const adultPhrases = containsPhrase(haystack, ADULT_PHRASES);
  for (const phrase of adultPhrases) {
    signals.push(`Adult wording: "${phrase}"`);
  }

  const kidsPhrases = containsPhrase(haystack, KIDS_PHRASES);
  for (const phrase of kidsPhrases) {
    signals.push(`Kids wording: "${phrase}"`);
  }

  const mustHide = (moderation.categories || []).some((category) =>
    ALWAYS_HIDE_CATEGORIES.includes(category)
  );

  // "Strong" means the moderation model itself returned an overall flag AND
  // at least one adult-relevant category — i.e. a real model verdict, not a
  // string match. Only a strong signal is allowed to override what the
  // creator chose; a keyword-only hit raises the flag for a human without
  // silently reclassifying anyone's video.
  const strong = mustHide || (moderation.checked && moderation.flagged && adultCategories.length > 0);

  if (adultCategories.length > 0 || adultPhrases.length > 0) {
    return { suggested: "adult", signals, strong, mustHide };
  }

  if (kidsPhrases.length > 0) {
    return { suggested: "kids", signals, strong: false, mustHide: false };
  }

  return { suggested: "everyone", signals, strong: false, mustHide: false };
}

export interface AudienceDecision {
  /** What actually gets stored on the video. */
  audience: VideoAudience;
  /** True when the AI disagreed with the creator — surfaces in the admin queue. */
  audienceMismatch: boolean;
  audienceSuggested: VideoAudience;
  audienceSignals: string[];
  /** True when the item must be kept out of every public listing. */
  hide: boolean;
}

// Reconciles the creator's declared audience with the AI's. The rules, in
// order of how much they matter:
//
//  1. Adult signals on something declared KIDS is the dangerous case — that
//     is content aimed at the people least able to handle it. It is always
//     pulled out of Kids, always flagged, even on a weak signal.
//  2. A STRONG adult verdict overrides any non-adult declaration.
//  3. A WEAK adult signal (keywords only) flags for review but leaves the
//     creator's choice alone — an AI false positive must not be able to
//     bury a legitimate video by itself.
//  4. The AI suggesting "kids" for something declared Everyone is not a
//     safety problem at all and is ignored entirely; plenty of
//     general-audience content mentions children.
export function decideAudience(
  declared: VideoAudience,
  classification: AudienceClassification
): AudienceDecision {
  const base = {
    audienceSuggested: classification.suggested,
    audienceSignals: classification.signals,
  };

  if (classification.suggested !== "adult") {
    return { ...base, audience: declared, audienceMismatch: false, hide: classification.mustHide };
  }

  // Rule 1 — adult signals on a Kids upload.
  if (declared === "kids") {
    return {
      ...base,
      // Never "adult" off a weak signal, but never left in Kids either.
      audience: classification.strong ? "adult" : "everyone",
      audienceMismatch: true,
      hide: classification.mustHide || classification.strong,
    };
  }

  // Rule 2 — a strong verdict overrides Everyone.
  if (classification.strong && declared !== "adult") {
    return { ...base, audience: "adult", audienceMismatch: true, hide: classification.mustHide };
  }

  // Rule 3 — weak signal, creator's choice stands, admin still sees it.
  if (declared !== "adult") {
    return { ...base, audience: declared, audienceMismatch: true, hide: classification.mustHide };
  }

  // Creator already said 18+ and the AI agrees — nothing to flag.
  return { ...base, audience: "adult", audienceMismatch: false, hide: classification.mustHide };
}
