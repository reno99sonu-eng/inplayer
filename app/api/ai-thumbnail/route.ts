import { NextRequest, NextResponse } from "next/server";

const VISION_MODELS = ["gpt-4o-mini", "gpt-4o"];
const MAX_FRAMES = 5;
const PER_CALL_TIMEOUT_MS = 45_000;

export async function POST(request: NextRequest) {
  try {
    const { frameUrls, title, category, prompt, generateNew } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "AI is not configured yet. Please contact the site admin.",
          debug: "OPENAI_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    // MODE A: Real DALL-E Image Generation when requested
    if (generateNew || (prompt && typeof prompt === "string" && !frameUrls?.length)) {
      if (process.env.OPENAI_API_KEY) {
        try {
          const cleanTitle = (title || prompt || "Vibrant video thumbnail").trim();
          const imagePrompt = `High quality, cinematic, vibrant video thumbnail for "${cleanTitle}". Category: ${category || "General"}. Professional studio lighting, ultra detailed, eye-catching composition, 16:9 ratio.`;
          
          console.log("Generating DALL-E 3 image with prompt:", imagePrompt);

          const dallEResponse = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "dall-e-3",
              prompt: imagePrompt,
              n: 1,
              size: "1024x1024",
              quality: "standard",
            }),
          });

          const dallEData = await dallEResponse.json();

          if (dallEResponse.ok) {
            const generatedUrl = dallEData?.data?.[0]?.url;
            if (generatedUrl) {
              return NextResponse.json({
                thumbnailUrl: generatedUrl,
                generated: true,
                reason: "Custom AI video thumbnail generated using DALL-E 3.",
              });
            }
          } else {
            console.error("DALL-E 3 generation failed:", dallEData);
            const apiMsg = dallEData?.error?.message || "DALL-E 3 generation failed.";
            return NextResponse.json(
              { error: `AI Image Generation error: ${apiMsg}` },
              { status: dallEResponse.status || 500 }
            );
          }
        } catch (genErr) {
          console.error("DALL-E thumbnail generation exception:", genErr);
          return NextResponse.json(
            { error: "Couldn't generate AI thumbnail image right now. Please try again." },
            { status: 500 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "OPENAI_API_KEY is required for AI Image Generation." },
          { status: 500 }
        );
      }
    }

    // MODE B: OpenAI GPT-4o-mini Vision Frame Selection
    if (!Array.isArray(frameUrls) || frameUrls.length === 0) {
      return NextResponse.json(
        { error: "No candidate thumbnail frames provided." },
        { status: 400 }
      );
    }

    const candidates = frameUrls
      .filter((u): u is string => typeof u === "string" && (u.startsWith("https://") || u.startsWith("data:image/")))
      .slice(0, MAX_FRAMES);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No usable candidate thumbnail frames were provided." },
        { status: 400 }
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
            model: process.env.OPENAI_API_KEY ? model : "qwen/qwen3.6-27b",
            messages: [{ role: "user", content }],
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });

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
              console.error("AI thumbnail: couldn't parse response as JSON:", raw, parseErr);
            }
          }

          lastErrorStatus = 502;
          lastErrorMessage = "AI couldn't confidently pick a thumbnail from your video.";
          continue;
        }

        const errorBody = await response.text();
        console.error(`AI vision API error (${model}):`, response.status, errorBody);
        lastErrorStatus = response.status;

        if (response.status === 404 || response.status === 429 || response.status >= 500) {
          continue;
        }

        break;
      } catch (err) {
        console.error(`AI vision request failed (${model}):`, err);
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
