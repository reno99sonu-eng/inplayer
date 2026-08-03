// Server-side AI helper for caption translation using OpenAI / Groq
const CANDIDATE_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
];

const PER_CALL_TIMEOUT_MS = 60_000;

async function aiGenerateText(userPrompt: string, systemPrompt?: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

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
          temperature: 0.3,
          messages,
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

async function runVttTransform(userPrompt: string, systemPrompt?: string): Promise<string | null> {
  const result = await aiGenerateText(userPrompt, systemPrompt);
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
  const systemPrompt = `You are an expert native translator and localization specialist for Indian regional languages (Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Hindi, Bengali).
Your mission is to translate video subtitles into natural, accurate, and contextually rich ${targetLanguageName}.

CRITICAL LOCALIZATION & MEANING RULES:
1. MEANING OVER LITERAL WORDS: Do NOT do word-for-word machine translation. Translate the TRUE CONTEXTUAL MEANING, emotion, and intent of the speech as a native ${targetLanguageName} speaker would naturally express it.
2. NATURAL COLLOQUIAL GRAMMAR: Use standard native script with accurate grammar, proper verb tenses, and natural conversational phrasing in ${targetLanguageName}.
3. LOANWORDS & MODERN TERMS: Keep common English technical terms, brand names, or modern words naturally transliterated or as spoken in modern ${targetLanguageName} conversations.
4. PRESERVE VTT FORMAT: Keep all WebVTT headers ("WEBVTT"), timestamps (e.g. "00:00:01.000 --> 00:00:04.000"), and cue numbers exactly intact.
5. SHORT CUE LENGTH: Keep each cue short (maximum 2 lines per cue, max 45 characters per line).`;

  const userPrompt = `Translate the text lines of the following WebVTT file into natural, contextually accurate ${targetLanguageName}:

WebVTT File:
${vtt}`;

  return runVttTransform(userPrompt, systemPrompt);
}

export async function cleanupVtt(
  vtt: string,
  languageName: string
): Promise<string | null> {
  const systemPrompt = `You are a professional audio proofreader and native language expert in ${languageName}.
Your task is to fix automatically-generated speech-recognition subtitles so they read as natural, grammatically correct ${languageName}.

PROOFREADING RULES:
1. FIX ASR ERRORS: Correct phonetically misheard words, garbled script, or incorrect auto-generated words into proper ${languageName}.
2. CONTEXTUAL ACCURACY: Ensure every sentence accurately reflects what the speaker intended to say.
3. PRESERVE INTENDED LOANWORDS: Keep English terms or brand names that the speaker genuinely uttered in English.
4. PRESERVE VTT FORMAT: Keep all WebVTT headers, timestamps, and cue structures identical.`;

  const userPrompt = `Proofread and correct the text lines of the following WebVTT file into clean ${languageName}:

WebVTT File:
${vtt}`;

  return runVttTransform(userPrompt, systemPrompt);
}
