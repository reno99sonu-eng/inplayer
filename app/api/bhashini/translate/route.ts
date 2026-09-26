import { NextRequest, NextResponse } from "next/server";
import {
  translateTextWithBhashini,
  translateVttWithBhashini,
  BHASHINI_SUPPORTED_LANGUAGES,
} from "@/app/lib/bhashiniTranslate";

export const dynamic = "force-dynamic";

/**
 * POST /api/bhashini/translate
 * Secure server-side translation proxy for Web and Android clients.
 * Keeps Bhashini credentials completely hidden from client code and browser network tabs.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, textList, vtt, targetLang, sourceLang = "en" } = body;

    if (!targetLang || typeof targetLang !== "string") {
      return NextResponse.json(
        { error: "Target language code ('targetLang') is required." },
        { status: 400 }
      );
    }

    const normalizedTarget = targetLang.toLowerCase().trim();
    if (!BHASHINI_SUPPORTED_LANGUAGES[normalizedTarget]) {
      return NextResponse.json(
        {
          error: `Language '${targetLang}' is not in the supported Bhashini roster.`,
          supportedLanguages: Object.keys(BHASHINI_SUPPORTED_LANGUAGES),
        },
        { status: 400 }
      );
    }

    // 1. WebVTT subtitle translation mode
    if (typeof vtt === "string" && vtt.includes("-->")) {
      const translatedVtt = await translateVttWithBhashini(
        vtt,
        normalizedTarget,
        sourceLang
      );
      if (!translatedVtt) {
        return NextResponse.json(
          {
            error: "Bhashini subtitle translation unavailable. Upstream credentials pending or quota limit reached.",
            fallbackAvailable: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        vtt: translatedVtt,
        targetLang: normalizedTarget,
        sourceLang,
      });
    }

    // 2. Batch text translation mode
    if (Array.isArray(textList) && textList.length > 0) {
      const translatedList = await translateTextWithBhashini(
        textList.map(String),
        normalizedTarget,
        sourceLang
      );
      if (!translatedList) {
        return NextResponse.json(
          {
            error: "Bhashini batch translation unavailable.",
            fallbackAvailable: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        translations: translatedList,
        targetLang: normalizedTarget,
        sourceLang,
      });
    }

    // 3. Single text string translation mode
    if (typeof text === "string" && text.trim()) {
      const results = await translateTextWithBhashini(
        [text.trim()],
        normalizedTarget,
        sourceLang
      );
      if (!results || results.length === 0) {
        return NextResponse.json(
          {
            error: "Bhashini translation unavailable.",
            fallbackAvailable: true,
          },
          { status: 503 }
        );
      }
      return NextResponse.json({
        success: true,
        translatedText: results[0],
        targetLang: normalizedTarget,
        sourceLang,
      });
    }

    return NextResponse.json(
      { error: "Provide either 'text', 'textList', or 'vtt' in the request body." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("[Bhashini API Error]:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Internal server error during translation request." },
      { status: 500 }
    );
  }
}
