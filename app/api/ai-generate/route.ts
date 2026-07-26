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

    console.log("GROQ_API_KEY exists:", !!process.env.GROQ_API_KEY);

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

    let lastErrorStatus = 500;

    for (const model of CANDIDATE_MODELS) {
      console.log("Trying model:", model);
    
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
              messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
          }
        );
    
        console.log("Groq status:", response.status);
    
        if (response.ok) {
          const data = await response.json();
    
          const text = data?.choices?.[0]?.message?.content;
    
          if (typeof text === "string" && text.trim()) {
            console.log(`AI generate succeeded using model: ${model}`);
            return NextResponse.json({ text });
          }
    
          return NextResponse.json(
            {
              error: "Groq returned an empty response.",
            },
            { status: 502 }
          );
        }
    
        const errorBody = await response.text();
    
        console.error(
          `Groq API error (${model}):`,
          response.status,
          errorBody
        );
    
        lastErrorStatus = response.status;
    
        if (
          response.status === 404 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          continue;
        }
    
        break;
      } catch (err) {
        console.error(`Groq request failed (${model}):`, err);
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (error) {
    console.error("AI generate route error:", error);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again." },
      { status: 500 }
    );
  }
}