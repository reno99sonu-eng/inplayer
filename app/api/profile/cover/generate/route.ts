import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/app/lib/verifyAuth";

// gpt-image-1 always returns base64 (no url/response_format option for
// this model — see OpenAI's Images API reference), which is actually
// convenient here: the client crops/recompresses it down to the cover
// photo's byte budget the exact same way it would a photo picked from
// disk (see compressDataUrlToBanner in app/lib/imageCompress.ts), so
// this route never has to worry about the DynamoDB size limit itself.
const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";
const PER_CALL_TIMEOUT_MS = 60_000;

function buildPrompt(name: string, handle: string | null): string {
  return (
    `A wide, professional YouTube-style channel banner background image for a video ` +
    `streaming creator channel called "${name}"${handle ? ` (@${handle})` : ""}. ` +
    `Abstract, cinematic, dynamic and energetic mood, with warm orange and amber ` +
    `accent colors on a dark navy background, matching a modern video platform's ` +
    `brand. No text, no words, no letters, no logos, no watermarks, no people, no faces.`
  );
}

export async function POST(request: NextRequest) {
  let user;

  try {
    user = await verifyAuth(request);
  } catch {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI cover photo generation is not configured yet. Please contact the site admin.",
        debug: "OPENAI_API_KEY is missing",
      },
      { status: 500 }
    );
  }

  let name = "";
  let handle: string | null = null;
  try {
    const body = await request.json();
    name = typeof body?.name === "string" ? body.name.trim() : "";
    handle = typeof body?.handle === "string" ? body.handle.trim() : null;
  } catch {
    // No/invalid JSON body — fall back to the token's own name below.
  }
  if (!name) name = user.name || "My Channel";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: buildPrompt(name, handle),
        size: "1536x1024",
        quality: "medium",
        n: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenAI image generation error:", response.status, errorBody);

      // gpt-image-1 specifically requires "Organization Verification" on
      // the OpenAI account (separate from just adding billing/an API
      // key) — a valid key with no verification fails every call with
      // exactly this 403, which reads as "misconfigured" without this
      // hint. See platform.openai.com/settings/organization/general.
      if (response.status === 403 && errorBody.toLowerCase().includes("verif")) {
        return NextResponse.json(
          {
            error:
              "This OpenAI account isn't verified for AI image generation yet. Go to platform.openai.com/settings/organization/general and click \"Verify Organization,\" then try again in about 15 minutes.",
          },
          { status: 500 }
        );
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "AI cover photo generation isn't set up correctly. Please contact the site admin." },
          { status: 500 }
        );
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: "AI cover photo generation is busy right now. Please try again in a moment." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Couldn't generate a cover photo right now. Please try again shortly." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;

    if (typeof b64 !== "string" || !b64) {
      console.error("OpenAI image generation: no b64_json in response", data);
      return NextResponse.json(
        { error: "AI couldn't generate a cover photo this time. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ dataUrl: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("OpenAI image generation request failed:", err);
    return NextResponse.json(
      { error: "Couldn't generate a cover photo right now. Please try again shortly." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
