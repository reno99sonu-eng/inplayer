import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";

// Real OpenAI-backed replacement for the Advertising console's "AI" buttons.
// The console previously imported from app/lib/aiAdGenerator.ts, which —
// despite its name and the "Magic AI Auto-Generate" / "AI Image Vision
// Engine" labels in the UI — never called any AI model at all: title
// generation was `titles[Math.floor(Math.random() * titles.length)]` off a
// small hardcoded list (picked via a crude average-pixel-color bucket, not
// real image understanding), and "auto-generate with no image" drew a fixed
// SVG gradient template. That's why results looked identical/irrelevant no
// matter what was uploaded — nothing ever looked at the actual file. This
// route replaces both paths with real calls to OpenAI, gated on the same
// OPENAI_API_KEY already used by app/api/profile/cover/generate.
const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const PER_CALL_TIMEOUT_MS = 60_000;

type Placement = "homepage" | "watch" | "weekly_featured" | "midroll";

const PLACEMENT_CONTEXT: Record<Placement, string> = {
  homepage: "a homepage ad card shown among video thumbnails on InPlayer's homepage (roughly 16:9 landscape)",
  watch: "a watch-page ad card shown in the 'Up Next' rail next to the video, styled like a video thumbnail (roughly 16:9 landscape)",
  weekly_featured: "InPlayer's Weekly Featured hero banner — a large, prominent wide banner (roughly 16:5, letterbox shape)",
  midroll: "a full-screen ad shown as a mid-roll break inside video playback (roughly 16:9 landscape)",
};

function contextFor(placement: string): string {
  return PLACEMENT_CONTEXT[placement as Placement] || PLACEMENT_CONTEXT.homepage;
}

function withTimeout(): { controller: AbortController; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  return { controller, clear: () => clearTimeout(timer) };
}

// The verified-organization 403 is the single most common failure mode for
// any OpenAI *image* call on a fresh paid key — same hint as
// app/api/profile/cover/generate/route.ts, kept identical so the message a
// user sees is consistent everywhere in the app.
function describeOpenAIError(status: number, body: string): { message: string; httpStatus: number } {
  if (status === 403 && body.toLowerCase().includes("verif")) {
    return {
      message:
        "This OpenAI account isn't verified for AI image generation yet. Go to platform.openai.com/settings/organization/general and click \"Verify Organization,\" then try again in about 15 minutes.",
      httpStatus: 500,
    };
  }
  if (status === 401 || status === 403) {
    return { message: "The OpenAI API key isn't set up correctly. Please contact the site admin.", httpStatus: 500 };
  }
  if (status === 429) {
    return { message: "OpenAI is busy or the account is rate-limited right now. Please try again in a moment.", httpStatus: 429 };
  }
  return { message: "Couldn't reach OpenAI right now. Please try again shortly.", httpStatus: 502 };
}

async function generateTitleFromImage(apiKey: string, imageDataUrl: string, placement: string): Promise<string> {
  const prompt =
    `You are writing a short, accurate caption for ${contextFor(placement)} on a video streaming platform ` +
    `called InPlayer. Look closely at the attached ad creative image and write ONE punchy ad title, under 70 ` +
    `characters, that genuinely reflects what is shown or promoted in THIS specific image — do not invent ` +
    `claims the image doesn't support, and do not reuse generic stock ad copy. Respond with ONLY compact JSON ` +
    `in this exact shape: {"title": "<the title>"} — no other text before or after it.`;

  const { controller, clear } = withTimeout();
  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ai-ad-generate: OpenAI chat (vision) error:", response.status, errorBody);
      const { message, httpStatus } = describeOpenAIError(response.status, errorBody);
      throw Object.assign(new Error(message), { httpStatus });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw Object.assign(new Error("OpenAI didn't return a usable title."), { httpStatus: 502 });

    const parsed = JSON.parse(raw);
    const title = typeof parsed?.title === "string" ? parsed.title.trim() : "";
    if (!title) throw Object.assign(new Error("OpenAI didn't return a usable title."), { httpStatus: 502 });
    return title;
  } finally {
    clear();
  }
}

async function generateHeadlineText(apiKey: string, placement: string): Promise<string> {
  const prompt =
    `Write ONE short, punchy ad headline (under 45 characters) for InPlayer, a video streaming platform, to be ` +
    `rendered as bold on-image text for ${contextFor(placement)}. It should read like a real house-ad promoting ` +
    `InPlayer itself (e.g. going Pro, discovering creators, ad-free viewing) — not a generic filler phrase. ` +
    `Respond with ONLY compact JSON in this exact shape: {"headline": "<the headline>"} — no other text.`;

  const { controller, clear } = withTimeout();
  try {
    const response = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 100,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ai-ad-generate: OpenAI chat (headline) error:", response.status, errorBody);
      const { message, httpStatus } = describeOpenAIError(response.status, errorBody);
      throw Object.assign(new Error(message), { httpStatus });
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") throw Object.assign(new Error("OpenAI didn't return a usable headline."), { httpStatus: 502 });

    const parsed = JSON.parse(raw);
    const headline = typeof parsed?.headline === "string" ? parsed.headline.trim() : "";
    if (!headline) throw Object.assign(new Error("OpenAI didn't return a usable headline."), { httpStatus: 502 });
    return headline;
  } finally {
    clear();
  }
}

async function generateBannerImage(apiKey: string, placement: string, headline: string): Promise<string> {
  const prompt =
    `A professional, polished advertisement banner for "InPlayer", a video streaming platform, for use as ` +
    `${contextFor(placement)}. Modern, energetic, cinematic style with indigo/purple/pink gradient accents on a ` +
    `dark background. Include the exact bold headline text "${headline}" rendered clearly and legibly, spelled ` +
    `correctly, as the main text on the banner. Tasteful abstract shapes or subtle play-button/film motifs are ` +
    `fine. No real people's faces, no third-party logos or trademarks, no fake app store ratings, no fake UI ` +
    `screenshots.`;

  const { controller, clear } = withTimeout();
  try {
    const response = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ai-ad-generate: OpenAI image error:", response.status, errorBody);
      const { message, httpStatus } = describeOpenAIError(response.status, errorBody);
      throw Object.assign(new Error(message), { httpStatus });
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (typeof b64 !== "string" || !b64) {
      throw Object.assign(new Error("OpenAI couldn't generate a banner image this time. Please try again."), { httpStatus: 502 });
    }
    return `data:image/png;base64,${b64}`;
  } finally {
    clear();
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI ad generation is not configured yet. Add OPENAI_API_KEY in Vercel and redeploy.",
        debug: "OPENAI_API_KEY is missing",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "full" ? "full" : "title";
  const placement = typeof body?.placement === "string" ? body.placement : "homepage";

  try {
    if (mode === "title") {
      const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
      if (!imageDataUrl.startsWith("data:image/")) {
        return NextResponse.json({ error: "Upload an image first, then generate a title from it." }, { status: 400 });
      }
      const title = await generateTitleFromImage(apiKey, imageDataUrl, placement);
      return NextResponse.json({ title });
    }

    // mode === "full": no image was uploaded — write a real headline, then
    // generate a real banner image with that exact headline baked in (the
    // site never overlays the "title" field visibly — see
    // AdThumbnailCard.tsx / FeaturedHeroAd.tsx, which only use it as alt
    // text — so the visible ad copy has to live inside the image itself).
    const headline = await generateHeadlineText(apiKey, placement);
    const imageUrl = await generateBannerImage(apiKey, placement, headline);
    return NextResponse.json({ title: headline, imageUrl });
  } catch (err) {
    const httpStatus = (err as { httpStatus?: number })?.httpStatus || 500;
    const message = err instanceof Error ? err.message : "Something went wrong generating that ad.";
    console.error("ai-ad-generate route error:", err);
    return NextResponse.json({ error: message }, { status: httpStatus });
  }
}
