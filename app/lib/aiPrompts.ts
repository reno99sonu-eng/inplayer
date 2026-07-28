// Shared AI-generation prompt builder + response parser for /api/ai-generate,
// used by both the Upload flow (app/upload/page.tsx) and the My Channel edit
// panel (app/my-videos/page.tsx) — kept in one place, same reason
// VideoMetadataFields itself is shared, so the two forms can never ask two
// different questions or parse the answer two different ways.

export interface AIPromptContext {
  title: string;
  description: string;
  category: string;
  contentType: "video" | "short";
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
      `Generate five distinct, high-CTR title options appropriate for the ${ctx.category} category` +
      (ctx.contentType === "short"
        ? " and short-form format (short, punchy, under 60 characters)."
        : ".") +
      ` Vary the style across the five (a question, a bold claim, a how-to framing, a curiosity hook, a plain descriptive title) so they read as genuinely different options rather than five rewordings of the same idea. Return ONLY the five titles, one per line, no numbering, no quotation marks.`
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
