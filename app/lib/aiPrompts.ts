// Shared AI-generation prompt builder + response parser for /api/ai-generate,
// used by both the Upload flow (app/upload/page.tsx) and the My Channel edit
// panel (app/my-videos/page.tsx) — kept in one place, same reason
// VideoMetadataFields itself is shared, so the two forms can never ask two
// different questions or parse the answer two different ways.

export interface AIPromptContext {
  title: string;
  description: string;
  category: string;
  contentType: "video" | "short" | "music";
  /** Free-text context the creator typed specifically to help the AI (see
      AITitleAssistModal) — the AI can't watch the actual video, so when
      this is present it's by far the strongest signal available, and is
      what actually fixed titles coming back "random": before this, the
      prompt had nothing but a filename and a category to go on. */
  userDescription?: string;
}

// A freshly-picked file's title defaults to its filename (see handleFile in
// app/upload/page.tsx) — camera/phone exports like "VID_20260714_183022" or
// "IMG_4821" carry no real content signal. Feeding that to the model as if
// it were a real working title is exactly why suggestions came back looking
// near-random: detect that shape and tell the model to ignore it instead.
function looksLikeAutoFilename(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/^(?:img|vid|dcim|video|movie|clip|mov|rec)[-_ ]?\d{3,}/i.test(t)) return true;
  if (/^\d{6,}/.test(t)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9-]{4,}$/i.test(t)) return true;
  return false;
}

export function buildAIGeneratePrompt(
  type: "title" | "description" | "tags",
  ctx: AIPromptContext
): string {
  const format =
    ctx.contentType === "short"
      ? "vertical short-form video (like a Reel/Short)"
      : ctx.contentType === "music"
        // Naming the format matters: without it the model writes video
        // copy ("watch", "in this video") for something nobody watches.
        ? "music track / song (audio only — the listener sees cover art, not footage)"
        : "video";
  const titleLine = looksLikeAutoFilename(ctx.title)
    ? "No real title yet — the current value is just an auto-generated filename, ignore it as content signal."
    : `Working title: ${ctx.title.trim()}`;
  const descriptionLine = ctx.description.trim()
    ? `Description: ${ctx.description.trim()}`
    : "No description written yet.";
  const creatorContextLine = ctx.userDescription?.trim()
    ? `What this video is actually about, in the creator's own words: ${ctx.userDescription.trim()}`
    : null;
  const context = [
    `This is a ${ctx.category} ${format}.`,
    creatorContextLine,
    titleLine,
    descriptionLine,
  ]
    .filter(Boolean)
    .join("\n");

  if (type === "title") {
    return (
      `${context}\n\n` +
      `Generate five title options appropriate for the ${ctx.category} category` +
      (ctx.contentType === "short"
        ? " and short-form format (short, punchy, under 60 characters)."
        : ".") +
      ` Each of the five must be written in a genuinely different TONE, not just a different structure — use exactly these five tones, one per title, in this order: ` +
      `(1) high-CTR/clickbait — bold, urgent, makes a big promise; ` +
      `(2) funny/playful — a light, witty, or self-aware title; ` +
      `(3) dramatic/urgent — intense, high-stakes phrasing; ` +
      `(4) minimal/understated — plain, quiet, confident, no hype at all; ` +
      `(5) a genuine, curious question a real viewer would ask themselves. ` +
      `They should read like five different creators wrote them, not one voice restyled five times. Return ONLY the five titles, one per line, no numbering, no quotation marks, no labels identifying the tone.`
    );
  }

  if (type === "description") {
    return `${context}\n\nWrite a professional, engaging ${format} description a viewer would actually want to read, appropriate for the ${ctx.category} category. Return ONLY the description.`;
  }

  return `${context}\n\nGenerate 15 SEO-friendly, relevant tags for this ${ctx.category} ${format}. Return ONLY comma-separated tags, no hashtags, no numbering.`;
}

// Cleans Groq's raw multi-line title response into a deduped, capped list of
// real suggestions — shared so the Upload flow and My Channel edit panel
// display/apply AI titles identically instead of drifting apart.
export function parseAITitleSuggestions(rawText: string, max = 5): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const line of rawText.split("\n")) {
    const t = line
      .replace(/^\s*\d+[).\-\s]*/, "")
      .replace(/^["'“]|["'”]$/g, "")
      .trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(t);
    if (cleaned.length >= max) break;
  }

  return cleaned;
}
