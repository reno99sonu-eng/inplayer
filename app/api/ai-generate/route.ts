import { NextRequest, NextResponse } from "next/server";

// Candidate models for text generation using OpenAI (with gpt-4o-mini as primary fast model)
const CANDIDATE_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
];
const PER_CALL_TIMEOUT_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    console.log("AI prompt:", prompt);

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A prompt is required." },
        { status: 400 }
      );
    }

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

    let lastErrorStatus = 500;

    for (const model of CANDIDATE_MODELS) {
      console.log("Trying model:", model);

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
            model,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });

        console.log("AI status:", response.status);

        if (response.ok) {
          const data = await response.json();
          const text = data?.choices?.[0]?.message?.content;

          if (typeof text === "string" && text.trim()) {
            console.log(`AI generate succeeded using model: ${model}`);
            return NextResponse.json({ text });
          }

          return NextResponse.json(
            { error: "AI returned an empty response." },
            { status: 502 }
          );
        }

        const errorBody = await response.text();
        console.error(`AI API error (${model}):`, response.status, errorBody);

        lastErrorStatus = response.status;
        if (response.status === 404 || response.status === 429 || response.status >= 500) {
          continue;
        }

        break;
      } catch (err) {
        console.error(`AI request failed (${model}):`, err);
        continue;
      } finally {
        clearTimeout(timer);
      }
    }

    console.error("AI generate: all candidate models exhausted, last status:", lastErrorStatus);
    return NextResponse.json(
      { error: "AI title generation is temporarily unavailable. Please try again shortly." },
      { status: lastErrorStatus >= 400 ? lastErrorStatus : 502 }
    );
  } catch (error) {
    console.error("AI generate route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500 }
    );
  }
}