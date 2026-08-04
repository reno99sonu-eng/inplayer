import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/isAdmin";

// Real OpenAI-backed generator for the Navbar Theme Manager's "Custom
// Occasion Prompt" field. Before this route existed, app/lib/
// aiNavbarThemeGenerator.ts's generateAiNavbarThemeImage(occasionId,
// customPrompt) silently IGNORED the customPrompt argument entirely — typing
// any custom occasion and clicking "Magic AI Auto-Generate Theme" just fell
// through to the same generic sparkle-burst SVG every time, regardless of
// what was typed. The six preset occasions (Independence Day, Diwali, Holi,
// Republic Day, New Year, Cyberpunk) are deliberately left as-is: they're
// real, hand-designed SVG art that correctly matches their occasion every
// time, which is a better result than an AI call for a fixed, known set —
// only the free-text "custom" case actually needs a real model, since
// nothing can be hardcoded for input nobody typed yet.
const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const PER_CALL_TIMEOUT_MS = 60_000;

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
        error: "AI theme generation is not configured yet. Add OPENAI_API_KEY in Vercel and redeploy.",
        debug: "OPENAI_API_KEY is missing",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const occasionPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!occasionPrompt) {
    return NextResponse.json({ error: "Type a custom occasion first." }, { status: 400 });
  }

  const prompt =
    `A small, tasteful decorative graphic motif celebrating "${occasionPrompt}", to sit behind a dark website ` +
    `navigation bar's logo as a festive accent — think a compact emblem, icon cluster, or light sparkle/confetti ` +
    `pattern, NOT a full scene or poster. Vibrant, glowing, celebratory style on a fully transparent background. ` +
    `No text, no words, no letters, no watermark, no navigation bar or UI elements drawn in — just the standalone ` +
    `decorative graphic itself.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "medium",
        background: "transparent",
        n: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ai-navbar-theme-generate: OpenAI image error:", response.status, errorBody);
      const { message, httpStatus } = describeOpenAIError(response.status, errorBody);
      return NextResponse.json({ error: message }, { status: httpStatus });
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (typeof b64 !== "string" || !b64) {
      return NextResponse.json({ error: "OpenAI couldn't generate a theme graphic this time. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ imageUrl: `data:image/png;base64,${b64}`, title: occasionPrompt });
  } catch (err) {
    console.error("ai-navbar-theme-generate route error:", err);
    return NextResponse.json({ error: "Couldn't generate that theme graphic right now. Please try again shortly." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
