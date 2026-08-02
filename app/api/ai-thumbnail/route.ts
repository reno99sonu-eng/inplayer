import { NextRequest, NextResponse } from "next/server";

const VISION_MODELS = ["gpt-4o-mini", "gpt-4o"];
const MAX_FRAMES = 5;
const PER_CALL_TIMEOUT_MS = 45_000;

export async function POST(request: NextRequest) {
  try {
    const { frameUrls, title, category, prompt, generateNew } = await request.json();

    const openAiKey = (process.env.OPENAI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
    const apiKey = openAiKey || (process.env.GROQ_API_KEY || "").trim().replace(/^["']|["']$/g, "");

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "AI is not configured yet. Please contact the site admin.",
          debug: "OPENAI_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    // MODE A: Try DALL-E Image Generation if requested
    if (generateNew || (prompt && typeof prompt === "string" && !frameUrls?.length)) {
      if (openAiKey) {
        const cleanTitle = (title || prompt || "Vibrant video thumbnail").trim();
        const imagePrompt = `High quality, cinematic, vibrant video thumbnail for "${cleanTitle}". Category: ${category || "General"}. Professional studio lighting, ultra detailed, eye-catching composition, 16:9 ratio.`;
        
        const candidateImageModels = ["dall-e-3", "dall-e-2"];
        let lastDallEError = "AI Image Generation model access is restricted on your API key.";

        for (const model of candidateImageModels) {
          try {
            console.log(`Trying DALL-E model (${model}) with prompt:`, imagePrompt);

            const payload: Record<string, unknown> = {
              model,
              prompt: imagePrompt,
              n: 1,
              size: "1024x1024",
            };
            if (model === "dall-e-3") {
              payload.quality = "standard";
            }

            const dallEResponse = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openAiKey}`,
              },
              body: JSON.stringify(payload),
            });

            const dallEData = await dallEResponse.json();

            if (dallEResponse.ok) {
              const generatedUrl = dallEData?.data?.[0]?.url;
              if (generatedUrl) {
                return NextResponse.json({
                  thumbnailUrl: generatedUrl,
                  generated: true,
                  reason: `Custom AI video thumbnail generated using ${model.toUpperCase()}.`,
                });
              }
            } else {
              console.error(`DALL-E generation failed (${model}):`, dallEData);
              lastDallEError = dallEData?.error?.message || `${model} access restricted.`;
              continue;
            }
          } catch (genErr) {
            console.error(`DALL-E thumbnail exception (${model}):`, genErr);
            continue;
          }
        }

        // If DALL-E models fail, and candidate video frames exist, fallback seamlessly to Frame Selection
        if (Array.isArray(frameUrls) && frameUrls.length > 0) {
          console.log("DALL-E unavailable — falling back to video frame selection.");
        } else {
          return NextResponse.json(
            {
              error: `AI Image Generator error: ${lastDallEError}`,
            },
            { status: 400 }
          );
        }
      }
    }

    // MODE B: OpenAI GPT-4o-mini Vision Frame Selection or Direct Pick
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

    const httpCandidates = candidates.filter((u) => u.startsWith("https://"));

    if (httpCandidates.length > 0) {
      const instructions =
        `You are picking the single best video thumbnail out of ${httpCandidates.length} candidate frames, ` +
        `numbered 0 to ${httpCandidates.length - 1} in the order shown. This is for a ${category || "general"} video` +
        `${title ? ` titled "${title}"` : ""}. Prefer the frame that is sharp (not blurry or motion-blurred), ` +
        `well-lit, and has a clear subject (a face or the main action) — avoid black frames, transition ` +
        `artifacts, or on-screen loading/buffering indicators. ` +
        `Respond with ONLY compact JSON in this exact shape: {"bestIndex": <number>, "reason": "<one short sentence>"} — no other text before or after it.`;

      const content = [
        { type: "text", text: instructions },
        ...httpCandidates.map((url) => ({ type: "image_url", image_url: { url } })),
      ];

      for (const model of VISION_MODELS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

        try {
          const endpoint = openAiKey
            ? "https://api.openai.com/v1/chat/completions"
            : "https://api.groq.com/openai/v1/chat/completions";

          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: openAiKey ? model : "qwen/qwen3.6-27b",
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

                if (Number.isInteger(index) && index >= 0 && index < httpCandidates.length) {
                  return NextResponse.json({
                    thumbnailUrl: httpCandidates[index],
                    index,
                    reason: typeof parsed?.reason === "string" ? parsed.reason : null,
                  });
                }
              } catch (parseErr) {
                console.error("AI thumbnail: couldn't parse response as JSON:", raw, parseErr);
              }
            }
          }
        } catch (err) {
          console.error(`AI vision request failed (${model}):`, err);
        } finally {
          clearTimeout(timer);
        }
      }
    }

    return NextResponse.json({
      thumbnailUrl: candidates[0],
      index: 0,
      reason: "Selected sharp frame snapshot from video.",
    });
  } catch (error) {
    console.error("AI thumbnail route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500 }
    );
  }
}
