// Server-side Gemini helper for caption translation. Same key and same
// model-fallback strategy as app/api/ai-generate (Gemini deprecates models
// often — falling through the list protects the feature from breaking).
const CANDIDATE_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
];

async function geminiGenerate(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string" && text.trim()) return text;
        return null;
      }

      // Model retired/unknown — try the next candidate.
      if (response.status === 404) continue;

      console.error(`Gemini error (${model}):`, response.status);
      return null;
    } catch (err) {
      console.error(`Gemini request failed (${model}):`, err);
      return null;
    }
  }

  return null;
}

// Translates a WebVTT subtitle file into the target language, preserving
// every timestamp and cue exactly. Returns null on any failure — caption
// translation is always best-effort and must never break the webhook that
// calls it.
export async function translateVtt(
  vtt: string,
  targetLanguageName: string
): Promise<string | null> {
  const prompt = `You are a professional subtitle translator. Translate the TEXT LINES of the following WebVTT subtitle file into ${targetLanguageName}.

STRICT RULES:
- Keep the exact same VTT structure: the "WEBVTT" header, every timestamp line (e.g. "00:00:01.000 --> 00:00:04.000"), cue ordering, and blank lines must remain EXACTLY as they are.
- Translate ONLY the subtitle text lines.
- Do not add any commentary, notes, numbering, or markdown/code fences.
- Output the complete translated VTT file and nothing else.

VTT FILE:
${vtt}`;

  const result = await geminiGenerate(prompt);
  if (!result) return null;

  // Models occasionally wrap output in code fences despite instructions —
  // strip them so the file stays valid VTT.
  let cleaned = result.trim();
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");

  // Sanity check: must still look like a VTT file with timestamps.
  if (!cleaned.startsWith("WEBVTT") || !cleaned.includes("-->")) {
    console.error("Translated output doesn't look like valid VTT — skipping.");
    return null;
  }

  return cleaned;
}
