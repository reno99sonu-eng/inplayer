import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Text generation for titles / descriptions / tags. gpt-4.1-mini first (better
// writing, and it can see images), gpt-4o-mini as the fallback.
const CANDIDATE_MODELS = ["gpt-4.1-mini", "gpt-4o-mini"];
const PER_CALL_TIMEOUT_MS = 45_000;
const MAX_IMAGES = 4;

// Without images the model only ever sees a category and (usually) a camera
// filename, so every description/tag set came back as the same generic
// filler no matter what was uploaded. Callers can now pass a few real
// frames from the video (or a music track's cover art) and the model writes
// about what is actually in them.
const GROUNDING_NOTE =
  "\n\nAttached are real frames from this exact upload (or its cover art, for music). " +
  "Base your answer on what is actually visible in them — the people, setting, objects and action. " +
  "Do not invent details the images and text above don't support.";

function sanitizeImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (u): u is string =>
        typeof u === "string" &&
        (u.startsWith("https://") || u.startsWith("data:image/")) &&
        // Keep the request small: ~200k chars is a 640px JPEG thumbnail.
        u.length <= 400_000
    )
    .slice(0, MAX_IMAGES);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
    }

    const openAiKey = (process.env.OPENAI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
    const groqKey = (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");

    if (!openAiKey && !groqKey) {
      return NextResponse.json(
        { error: "AI is not configured yet. Please contact the site admin.", debug: "OPENAI_API_KEY is missing" },
        { status: 500 }
      );
    }

    // Images only go to OpenAI; the Groq fallback stays text-only.
    const images = openAiKey ? sanitizeImages(body?.images) : [];
    const userContent =
      images.length > 0
        ? [
            { type: "text", text: prompt + GROUNDING_NOTE },
            ...images.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } })),
          ]
        : prompt;

    const endpoint = openAiKey
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";
    const apiKey = openAiKey || groqKey;
    const models = openAiKey ? CANDIDATE_MODELS : ["llama-3.3-70b-versatile"];

    let lastErrorStatus = 502;

    // If OpenAI can't use the images for any reason (e.g. it couldn't fetch
    // an https cover URL), retry text-only rather than failing the button.
    const attempts: Array<typeof userContent> = images.length > 0 ? [userContent, prompt] : [prompt];

    for (const content of attempts) {
      for (const model of models) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content }],
              temperature: 0.8,
            }),
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (typeof text === "string" && text.trim()) {
              return NextResponse.json({ text, grounded: content !== prompt });
            }
            lastErrorStatus = 502;
            continue;
          }

          const errorBody = await response.text();
          console.error(`AI API error (${model}):`, response.status, errorBody.slice(0, 500));
          lastErrorStatus = response.status;
        } catch (err) {
          console.error(`AI request failed (${model}):`, err);
        } finally {
          clearTimeout(timer);
        }
      }
    }

    return NextResponse.json(
      { error: "AI is temporarily unavailable. Please try again shortly." },
      { status: lastErrorStatus >= 400 ? lastErrorStatus : 502 }
    );
  } catch (error) {
    console.error("AI generate route error:", error);
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
