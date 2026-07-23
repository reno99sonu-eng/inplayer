import { NextRequest, NextResponse } from "next/server";

// Ordered from most to least preferred. If Groq retires or restricts one of
// these for new API keys, the code automatically falls through to the next
// one instead of breaking the whole feature — this protects against model
// deprecations/outages without needing a manual fix each time.
const CANDIDATE_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A prompt is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured yet. Please contact the site admin." },
        { status: 500 }
      );
    }

    let lastErrorStatus = 500;

    for (const model of CANDIDATE_MODELS) {
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
            messages: [{ role: "user", content: prompt }],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text =
          data?.choices?.[0]?.message?.content ??
          "No content was generated. Try rephrasing your prompt.";

        console.log(`AI generate succeeded using model: ${model}`);

        return NextResponse.json({ text });
      }

      const errorBody = await response.text();
      console.error(
        `Groq API error (model: ${model}):`,
        response.status,
        errorBody
      );

      lastErrorStatus = response.status;

      // Model unavailable/not found — try the next candidate in the list.
      if (response.status === 404) {
        continue;
      }

      if (response.status === 429) {
        return NextResponse.json(
          {
            error:
              "AI is a little busy right now (rate limit reached). Please wait a moment and try again.",
          },
          { status: 429 }
        );
      }

      // Any other error (not a missing-model issue) — stop and report it.
      break;
    }

    return NextResponse.json(
      { error: "Something went wrong generating content. Please try again." },
      { status: lastErrorStatus === 404 ? 502 : lastErrorStatus }
    );
  } catch (error) {
    console.error("AI generate route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500 }
    );
  }
}