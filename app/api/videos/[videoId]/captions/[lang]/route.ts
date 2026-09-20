import { NextRequest, NextResponse } from "next/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/app/lib/dynamodb";
import { splitLongVttCues, isMeaningfulSpeechTranscript } from "@/app/lib/vttChunker";
import { translateVttWithBhashini, BHASHINI_SUPPORTED_LANGUAGES } from "@/app/lib/bhashiniTranslate";
import { translateVtt } from "@/app/lib/translate";
import { CAPTION_TARGETS } from "@/app/lib/captions";

interface Params {
  params: Promise<{ videoId: string; lang: string }>;
}

// Serves a translated subtitle file (WebVTT) for a video. Automatically
// chunks long paragraph text into short 1-line/2-line YouTube-style cues.
// If the requested regional language is not yet cached, generates it on-demand
// using the Bhashini NMT pipeline and caches it directly into DynamoDB.
export async function GET(request: NextRequest, { params }: Params) {
  const { videoId, lang } = await params;
  const normalizedLang = lang.toLowerCase().trim();

  const result = await docClient.send(
    new GetCommand({
      TableName: "InPlayer-Videos",
      Key: { videoId },
    })
  );

  const rawVtt = result.Item?.captionsVtt?.[normalizedLang];

  // 1. Cached hit: serve immediately
  if (typeof rawVtt === "string" && rawVtt.startsWith("WEBVTT") && isMeaningfulSpeechTranscript(rawVtt)) {
    const cleanVtt = splitLongVttCues(rawVtt);
    return new NextResponse(cleanVtt, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 2. On-demand translation: find an existing base transcript
  const captionsVtt = result.Item?.captionsVtt as Record<string, string> | undefined;
  if (!captionsVtt || typeof captionsVtt !== "object") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Find preferred base language (en -> hi -> first valid)
  let baseLang = "en";
  let baseVtt = captionsVtt["en"];

  if (!baseVtt || !isMeaningfulSpeechTranscript(baseVtt)) {
    baseLang = "hi";
    baseVtt = captionsVtt["hi"];
  }

  if (!baseVtt || !isMeaningfulSpeechTranscript(baseVtt)) {
    const candidate = Object.keys(captionsVtt).find(
      (k) =>
        typeof captionsVtt[k] === "string" &&
        captionsVtt[k].startsWith("WEBVTT") &&
        isMeaningfulSpeechTranscript(captionsVtt[k])
    );
    if (candidate) {
      baseLang = candidate;
      baseVtt = captionsVtt[candidate];
    }
  }

  if (!baseVtt || typeof baseVtt !== "string" || !isMeaningfulSpeechTranscript(baseVtt)) {
    return NextResponse.json({ error: "No base subtitle transcript found." }, { status: 404 });
  }

  const targetMeta = CAPTION_TARGETS.find((t) => t.code === normalizedLang);
  const isSupported = Boolean(targetMeta || BHASHINI_SUPPORTED_LANGUAGES[normalizedLang]);

  if (!isSupported) {
    return NextResponse.json({ error: `Language '${normalizedLang}' is not supported.` }, { status: 404 });
  }

  // Translate with Bhashini NMT (with translateVtt fallback)
  let translatedVtt: string | null = null;
  try {
    translatedVtt = await translateVttWithBhashini(baseVtt, normalizedLang, baseLang);
  } catch (err) {
    console.warn(`[Captions] Bhashini translation failed for ${normalizedLang}:`, err);
  }

  if (!translatedVtt && targetMeta) {
    try {
      translatedVtt = await translateVtt(baseVtt, targetMeta.name, normalizedLang);
    } catch (err) {
      console.warn(`[Captions] Fallback translation failed for ${normalizedLang}:`, err);
    }
  }

  if (!translatedVtt || !translatedVtt.startsWith("WEBVTT")) {
    return NextResponse.json({ error: "Subtitle translation temporarily unavailable." }, { status: 503 });
  }

  const cleanVtt = splitLongVttCues(translatedVtt);

  // Cache in DynamoDB for instant future hits
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: "InPlayer-Videos",
        Key: { videoId },
        UpdateExpression: "SET captionsVtt.#lang = :vtt",
        ExpressionAttributeNames: { "#lang": normalizedLang },
        ExpressionAttributeValues: { ":vtt": cleanVtt },
      })
    );
  } catch (cacheErr) {
    console.warn(`[Captions] Failed to cache ${normalizedLang} in DynamoDB:`, cacheErr);
  }

  return new NextResponse(cleanVtt, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
