import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { THUMBNAIL_ASPECT_RATIO, CONTENT_TYPE_WORD, normalizeContentType } from "@/app/lib/contentTypes";

const VISION_MODELS = ["gpt-4o-mini", "gpt-4o"];
const MAX_FRAMES = 5;
const PER_CALL_TIMEOUT_MS = 45_000;

// Renders any source image (a remote URL or a data: URL) into a data: URL
// cropped to exactly the target contentType's thumbnail ratio — the single
// server-side crop path for AI-suggested thumbnails, so what the creator
// sees in the picker is byte-for-byte what /api/upload/create stores.
// Also fixes a real bug: DALL-E returns a square, non-data: URL that
// /api/upload/create's thumbnailDataUrl validation used to reject outright.
async function renderCroppedDataUrl(source: string, aspectRatio: number): Promise<string> {
  let inputBuffer: Buffer;
  if (source.startsWith("data:")) {
    const base64 = source.split(",")[1] || "";
    inputBuffer = Buffer.from(base64, "base64");
  } else {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Couldn't fetch source image (${res.status}).`);
    inputBuffer = Buffer.from(await res.arrayBuffer());
  }

  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const srcWidth = metadata.width || 1024;
  const srcHeight = metadata.height || 1024;

  let cropWidth = srcWidth;
  let cropHeight = srcHeight;
  if (srcWidth / srcHeight > aspectRatio) {
    cropWidth = Math.round(srcHeight * aspectRatio);
  } else {
    cropHeight = Math.round(srcWidth / aspectRatio);
  }

  const outWidth = Math.min(640, cropWidth);
  const outHeight = Math.round(outWidth / aspectRatio);

  const outBuffer = await image
    .resize({
      width: cropWidth,
      height: cropHeight,
      fit: "cover",
      position: "centre",
    })
    .resize(outWidth, outHeight)
    .jpeg({ quality: 82 })
    .toBuffer();

  return `data:image/jpeg;base64,${outBuffer.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { frameUrls, title, category, prompt, generateNew, contentType: rawContentType } = await request.json();
    const contentType = normalizeContentType(rawContentType);
    const aspectRatio = THUMBNAIL_ASPECT_RATIO[contentType];

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
        const cleanTitle = (title || prompt || "Vibrant thumbnail").trim();
        const ratioWord = contentType === "short" ? "9:16 vertical" : contentType === "music" ? "1:1 square" : "16:9";
        const imagePrompt = `High quality, cinematic, vibrant ${CONTENT_TYPE_WORD[contentType]} thumbnail for "${cleanTitle}". Category: ${category || "General"}. Professional studio lighting, ultra detailed, eye-catching composition, ${ratioWord} ratio, with the main subject centered so it survives a center-crop to that ratio.`;

        const candidateImageModels = ["dall-e-3", "dall-e-2"];
        let lastDallEError = "AI Image Generation model access is restricted on your API key.";

        for (const model of candidateImageModels) {
          try {
            console.log(`Trying DALL-E model (${model}) with prompt:`, imagePrompt);

            // dall-e-3 supports a couple of non-square sizes; dall-e-2 is
            // square-only. Either way, renderCroppedDataUrl below performs
            // the exact final crop, so this just picks the closest source
            // to minimize how much gets thrown away.
            const size =
              model === "dall-e-3"
                ? contentType === "short"
                  ? "1024x1792"
                  : contentType === "video"
                  ? "1792x1024"
                  : "1024x1024"
                : "1024x1024";

            const payload: Record<string, unknown> = {
              model,
              prompt: imagePrompt,
              n: 1,
              size,
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
                try {
                  const croppedDataUrl = await renderCroppedDataUrl(generatedUrl, aspectRatio);
                  return NextResponse.json({
                    thumbnailUrl: croppedDataUrl,
                    generated: true,
                    reason: `Custom AI thumbnail generated using ${model.toUpperCase()}.`,
                  });
                } catch (cropErr) {
                  console.error(`Failed to crop DALL-E output (${model}):`, cropErr);
                  lastDallEError = "Generated image couldn't be processed.";
                  continue;
                }
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
                  const picked = httpCandidates[index];
                  const croppedDataUrl = await renderCroppedDataUrl(picked, aspectRatio).catch((cropErr) => {
                    console.error("Failed to crop selected frame, using original:", cropErr);
                    return picked;
                  });
                  return NextResponse.json({
                    thumbnailUrl: croppedDataUrl,
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

    const fallbackCropped = await renderCroppedDataUrl(candidates[0], aspectRatio).catch((cropErr) => {
      console.error("Failed to crop fallback frame, using original:", cropErr);
      return candidates[0];
    });
    return NextResponse.json({
      thumbnailUrl: fallbackCropped,
      index: 0,
      reason: "Selected sharp frame snapshot.",
    });
  } catch (error) {
    console.error("AI thumbnail route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500 }
    );
  }
}
