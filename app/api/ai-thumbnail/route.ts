import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { THUMBNAIL_ASPECT_RATIO, CONTENT_TYPE_WORD, normalizeContentType } from "@/app/lib/contentTypes";

export const maxDuration = 120;

const VISION_MODELS = ["gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"];
// OpenAI retired dall-e-2/dall-e-3 — requests for them now fail with "The
// model ... does not exist", which is why every "AI thumbnail"/"AI cover"
// tap errored out. The gpt-image family returns base64 (b64_json) rather
// than a URL, and takes its own size/quality values.
const IMAGE_MODELS = ["gpt-image-1.5", "gpt-image-1-mini", "gpt-image-1"];
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
    const { frameUrls, title, description, category, prompt, generateNew, contentType: rawContentType } = await request.json();
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

    // MODE A: generate a brand-new image with OpenAI's gpt-image models.
    if (generateNew || (prompt && typeof prompt === "string" && !frameUrls?.length)) {
      if (openAiKey) {
        const cleanTitle = String(title || prompt || "Untitled").trim().slice(0, 200);
        const cleanDescription = typeof description === "string" ? description.trim().slice(0, 400) : "";
        const shape =
          contentType === "short"
            ? "tall vertical 9:16 composition"
            : contentType === "music"
              ? "square 1:1 album-cover composition"
              : "wide 16:9 landscape composition";
        const subject =
          contentType === "music"
            ? `album / single cover art for a song titled "${cleanTitle}"`
            : `a ${CONTENT_TYPE_WORD[contentType]} thumbnail for "${cleanTitle}"`;
        const imagePrompt =
          `Create ${subject}. Category: ${category || "General"}.` +
          (cleanDescription ? ` What it's about: ${cleanDescription}.` : "") +
          ` Eye-catching, high-contrast, professional lighting, one clear focal subject, ${shape}, ` +
          `main subject centered so it survives a centre-crop. No text, no letters, no logos, no watermarks.`;

        const size = contentType === "short" ? "1024x1536" : contentType === "music" ? "1024x1024" : "1536x1024";
        const errors: string[] = [];

        for (const model of IMAGE_MODELS) {
          const controller = new AbortController();
          // low quality: ~12s instead of ~45s at medium, and the result is shrunk
          // to 640px anyway, so the extra detail would never be visible.
          const timer = setTimeout(() => controller.abort(), 45_000);
          try {
            const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openAiKey}`,
              },
              body: JSON.stringify({ model, prompt: imagePrompt, n: 1, size, quality: "low" }),
              signal: controller.signal,
            });
            const imageData = await imageResponse.json().catch(() => null);

            if (!imageResponse.ok) {
              const message = imageData?.error?.message || `HTTP ${imageResponse.status}`;
              console.error(`AI image generation failed (${model}):`, message);
              errors.push(`${model}: ${message}`);
              continue;
            }

            const b64 = imageData?.data?.[0]?.b64_json;
            const url = imageData?.data?.[0]?.url;
            const source = typeof b64 === "string" && b64 ? `data:image/png;base64,${b64}` : typeof url === "string" ? url : null;
            if (!source) {
              errors.push(`${model}: empty response`);
              continue;
            }

            const croppedDataUrl = await renderCroppedDataUrl(source, aspectRatio);
            return NextResponse.json({
              thumbnailUrl: croppedDataUrl,
              generated: true,
              reason: `AI image generated with ${model}.`,
            });
          } catch (genErr) {
            console.error(`AI image generation exception (${model}):`, genErr);
            errors.push(`${model}: ${genErr instanceof Error ? genErr.message : String(genErr)}`);
          } finally {
            clearTimeout(timer);
          }
        }

        // Generation failed on every model — if we have real frames from the
        // video, fall through and let the vision model pick the best one
        // instead of failing outright.
        if (!Array.isArray(frameUrls) || frameUrls.length === 0) {
          // Provider messages stay in the server log only — they can echo a
          // masked piece of the API key or billing details.
          console.error("AI thumbnail: every image model failed:", errors.join(" | "));
          return NextResponse.json(
            { error: "Couldn't generate an AI image right now. Please try again in a moment." },
            { status: 502 }
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

    // OpenAI's (and Groq's OpenAI-compatible) vision endpoint accepts a
    // base64 data: URI in image_url.url exactly like a real https:// one —
    // this used to filter candidates down to https:// only, which silently
    // threw away every locally-extracted frame (they're all data: URLs) and
    // fell straight through to the "just crop frame 0, no AI involved"
    // fallback below without ever telling the caller AI selection didn't
    // actually happen.
    if (candidates.length > 0) {
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

                if (Number.isInteger(index) && index >= 0 && index < candidates.length) {
                  const picked = candidates[index];
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
