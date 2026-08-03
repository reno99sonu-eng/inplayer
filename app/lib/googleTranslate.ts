/**
 * Google Cloud Translation API (v2/v3 NMT) integration for Indian Regional Languages.
 * Provides ultra-fast, zero-hallucination, highly accurate translations for Tamil, Telugu,
 * Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Hindi, and Bengali.
 */

// BCP-47 language code mapping for Google Translate API
const GOOGLE_LANG_CODES: Record<string, string> = {
  en: "en",
  hi: "hi",
  bn: "bn",
  ta: "ta",
  te: "te",
  mr: "mr",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  pa: "pa",
  or: "or",
};

export async function googleTranslateText(
  textLines: string[],
  targetLangCode: string
): Promise<string[] | null> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.NEXT_PUBLIC_MAPS_API_KEY;
  if (!apiKey || textLines.length === 0) return null;

  const targetCode = GOOGLE_LANG_CODES[targetLangCode] || targetLangCode;

  try {
    const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: textLines,
        target: targetCode,
        format: "text",
      }),
    });

    if (!res.ok) {
      console.error(`Google Translate API error (${res.status})`);
      return null;
    }

    const data = await res.json();
    const translations = data?.data?.translations;
    if (Array.isArray(translations) && translations.length === textLines.length) {
      return translations.map((t: { translatedText: string }) => t.translatedText);
    }
    return null;
  } catch (err) {
    console.error("Google Translate request failed:", err);
    return null;
  }
}

export async function translateVttWithGoogle(
  vttContent: string,
  targetLangCode: string
): Promise<string | null> {
  if (!vttContent || !vttContent.includes("-->")) return null;

  const lines = vttContent.split(/\r?\n/);
  const textLinesToTranslate: string[] = [];
  const lineIndices: number[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("WEBVTT") &&
      !trimmed.includes("-->") &&
      !/^\d+$/.test(trimmed)
    ) {
      textLinesToTranslate.push(line);
      lineIndices.push(index);
    }
  });

  if (textLinesToTranslate.length === 0) return vttContent;

  const translatedLines = await googleTranslateText(textLinesToTranslate, targetLangCode);
  if (!translatedLines) return null;

  const resultLines = [...lines];
  lineIndices.forEach((lineIndex, i) => {
    resultLines[lineIndex] = translatedLines[i];
  });

  return resultLines.join("\n");
}
