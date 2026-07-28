import { NextRequest, NextResponse } from "next/server";

// Groq's only current vision (image-input) capable model — see
// console.groq.com/docs/vision. Kept as a list, same shape as
// api/ai-generate's CANDIDATE_MODELS, so a future second vision model (or a
// replacement if this one is retired) just slots in without another rewrite.
const VISION_MODELS = ["qwen/qwen3.6-27b"];
// Groq's vision endpoint caps a single request at 5 images.
const MAX_FRAMES = 5;
const PER_CALL_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  try {
    const { frameUrls, title, category } = await request.json();

    if (!Array.isArray(frameUrls) || frameUrls.length === 0) {
      return NextResponse.json(
        { error: "No candidate thumbnail frames were provided." },
        { status: 400 }
      );
    }

    const candidates = frameUrls
      .filter((u): u is string => typeof u === "string" && u.startsWith("https://"))
      .slice(0, MAX_FRAMES);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No usable candidate thumbnail frames were provided." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "AI is not configured yet. Please contact the site admin.",
          debug: "GROQ_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    const instructions =
      `You are picking the single best video thumbnail out of ${candidates.length} candidate frames, ` +
      `numbered 0 to ${candidates.length - 1} in the order shown. This is for a ${category || "general"} video` +
      `${title ? ` titled "${title}"` : ""}. Prefer the frame that is sharp (not blurry or motion-blurred), ` +
      `well-lit, and has a clear subject (a face or the main action) — avoid black frames, transition ` +
      `artifacts, or on-screen loading/buffering indicators. ` +
      `Respond with ONLY compact JSON in this exact shape: {"bestIndex": <number>, "reason": "<one short sentence>"} — no other text before or after it.`;

    const content = [
      { type: "text", text: instructions },
      ...candidates.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    let lastErrorStatus = 500;
    let lastErrorMessage = "AI thumbnail selection is temporarily unavailable. Please try again shortly.";

    for (const model of VISION_MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

      try {
        const response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content }],
              response_format: { type: "json_object" },
            }),
            signal: controller.signal,
          }
        );

        if (response.ok) {
          const data = await response.json();
          const raw = data?.choices?.[0]?.message?.content;

          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              const index = Number(parsed?.bestIndex);

              if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
                return NextResponse.json({
                  thumbnailUrl: candidates[index],
                  index,
                  reason: typeof parsed?.reason === "string" ? parsed.reason : null,
                });
              }
            } catch (parseErr) {
              console.error("AI thumbnail: couldn't parse Groq response as JSON:", raw, parseErr);
            }
          }

          lastErrorStatus = 502;
          lastErrorMessage = "AI couldn't confidently pick a thumbnail from your video.";
          continue;
        }

        const errorBody = await response.text();
        console.error(`Groq vision API error (${model}):`, response.status, errorBody);
        lastErrorStatus = response.status;

        if (response.status === 404 || response.status === 429 || response.status >= 500) {
          continue;
        }

        break;
      } catch (err) {
        console.error(`Groq vision request failed (${model}):`, err);
        continue;
      } finally {
        clearTimeout(timer);
      }
    }

    return NextResponse.json(
      { error: lastErrorMessage },
      { status: lastErrorStatus >= 400 ? lastErrorStatus : 502 }
    );
  } catch (error) {
    console.error("AI thumbnail route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500 }
    );
  }
}
