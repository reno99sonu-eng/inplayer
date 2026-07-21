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
        // A 200 with no usable text (e.g. safety-blocked) won't get better
        // on another model — give up rather than burn the whole list.
        return null;
      }

      // ANY non-OK status falls through to the next candidate model. This
      // is the important fix: the previous version returned null on
      // anything that wasn't a 404, so a single transient 503/429 (Gemini
      // servers briefly overloaded — which happens routinely) killed the
      // entire translation even though the very next model in the list
      // would have answered. Retired models (404), rate limits (429), and
      // server blips (5xx) are now all just "try the next one".
      console.error(`Gemini error (${model}): ${response.status} — trying next model`);
      continue;
    } catch (err) {
      // Network-level failure on this model — try the next one rather than
      // abandoning the whole translation.
      console.error(`Gemini request failed (${model}):`, err);
      continue;
    }
  }

  return null;
}

// Shared tail end of both translateVtt and cleanupVtt: sends the prompt,
// strips any stray code fences the model adds despite instructions, and
// sanity-checks the result still looks like a VTT file before handing it
// back. Returns null on any failure — both callers are always best-effort
// and must never break the webhook that calls them.
async function runVttTransform(prompt: string): Promise<string | null> {
  const result = await geminiGenerate(prompt);
  if (!result) return null;

  // Models occasionally wrap output in code fences despite instructions —
  // strip them so the file stays valid VTT.
  let cleaned = result.trim();
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");

  // Sanity check: must still look like a VTT file with timestamps.
  if (!cleaned.startsWith("WEBVTT") || !cleaned.includes("-->")) {
    console.error("Gemini VTT output doesn't look valid — skipping.");
    return null;
  }

  return cleaned;
}

// Translates a WebVTT subtitle file into the target language, preserving
// every timestamp and cue exactly.
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

  return runVttTransform(prompt);
}

// Mux's speech-to-text has no dedicated model for Hindi or Bengali (its
// explicit language hint only covers a fixed list of mostly-European
// languages), so videos spoken in those languages are always transcribed
// via "auto" detection — a mode that regularly misidentifies South Asian
// speech (most often tagging Hindi as Urdu) and can produce cue text that
// slips into the wrong script or mixes languages mid-sentence. This
// proofreads the raw transcript back into clean, consistent text in the
// language it's actually supposed to be, without touching timing. Meant
// to run once, on the source-language transcript, before it's stored as
// its own track or used as the basis for translation into the others.
export async function cleanupVtt(
  vtt: string,
  languageName: string
): Promise<string | null> {
  const prompt = `You are proofreading an automatically-generated WebVTT subtitle file. The audio is spoken in ${languageName}, but the speech-recognition system that produced this file does not fully support ${languageName} and may have output text in the wrong script, the wrong language, or a garbled mix of languages.

Rewrite ONLY the subtitle text lines so the whole file reads as natural, correct ${languageName} — EXCEPT for words the speaker genuinely said in another language (e.g. English brand names, loanwords, or intentionally code-switched phrases), which should stay as spoken.

STRICT RULES:
- Keep the exact same VTT structure: the "WEBVTT" header, every timestamp line (e.g. "00:00:01.000 --> 00:00:04.000"), cue ordering, and blank lines must remain EXACTLY as they are.
- Only rewrite the subtitle text lines themselves.
- Do not add any commentary, notes, numbering, or markdown/code fences.
- Output the complete corrected VTT file and nothing else.

VTT FILE:
${vtt}`;

  return runVttTransform(prompt);
}
