// Server-side AI helper for caption translation using OpenAI gpt-4o-mini
const CANDIDATE_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
];

const PER_CALL_TIMEOUT_MS = 60_000;

async function aiGenerateText(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const endpoint = process.env.OPENAI_API_KEY
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_API_KEY ? model : "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) return text;
        return null;
      }

      console.error(`AI caption error (${model}): ${response.status} — trying next model`);
      continue;
    } catch (err) {
      console.error(`AI caption request failed (${model}):`, err);
      continue;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

async function runVttTransform(prompt: string): Promise<string | null> {
  const result = await aiGenerateText(prompt);
  if (!result) return null;

  let cleaned = result.trim();
  cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");

  if (!cleaned.startsWith("WEBVTT") || !cleaned.includes("-->")) {
    console.error("AI VTT output doesn't look valid — skipping.");
    return null;
  }

  return cleaned;
}

export async function translateVtt(
  vtt: string,
  targetLanguageName: string
): Promise<string | null> {
  const prompt = `You are a professional video subtitle translator. Translate the TEXT LINES of the following WebVTT subtitle file into ${targetLanguageName}.

STRICT RULES:
- Keep the exact same VTT structure: the "WEBVTT" header, every timestamp line (e.g. "00:00:01.000 --> 00:00:04.000"), cue ordering, and blank lines must remain EXACTLY as they are.
- Translate ONLY the subtitle text lines into natural, concise ${targetLanguageName}.
- CRITICAL CAPTION LENGTH RULE: Keep every subtitle cue SHORT (maximum 2 lines per cue, max 45 characters per line). Do NOT generate long multi-line text blocks.
- Do not add any commentary, notes, numbering, or markdown/code fences.
- Output the complete translated VTT file and nothing else.

VTT FILE:
${vtt}`;

  return runVttTransform(prompt);
}

export async function cleanupVtt(
  vtt: string,
  languageName: string
): Promise<string | null> {
  const prompt = `You are proofreading an automatically-generated WebVTT subtitle file. The audio is spoken in ${languageName}, but the speech-recognition system that produced this file does not fully support ${languageName} and may have output text in the wrong script, the wrong language, or a garbled mix of languages.

Rewrite ONLY the subtitle text lines so the whole file reads as natural, correct ${languageName} — EXCEPT for words the speaker genuinely said in another language (e.g. English brand names, loanwords, or intentionally code-switched phrases), which should stay as spoken.

STRICT RULES:
- Keep the exact same VTT structure: the "WEBVTT" header, every timestamp line (e.g. "00:00:01.000 --> 00:00:04.000"), cue ordering, and blank lines must remain EXACTLY as they are.
- CRITICAL CAPTION LENGTH RULE: Keep every subtitle cue SHORT (maximum 2 lines per cue, max 45 characters per line). Do NOT generate long multi-line text blocks.
- Only rewrite the subtitle text lines themselves.
- Do not add any commentary, notes, numbering, or markdown/code fences.
- Output the complete corrected VTT file and nothing else.

VTT FILE:
${vtt}`;

  return runVttTransform(prompt);
}
