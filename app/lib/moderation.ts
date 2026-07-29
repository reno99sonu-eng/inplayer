// Real, automatic content moderation via OpenAI's Moderation API — the
// same OPENAI_API_KEY already configured for AI thumbnails/cover photos
// (see app/api/profile/cover/generate). The Moderation API itself is free
// to call. Used to auto-scan comments, direct messages, and video/Short
// titles+descriptions the instant they're posted, so policy-violating
// content doesn't have to wait for a human report.
const OPENAI_MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";
const TIMEOUT_MS = 8000;

export interface ModerationResult {
  // Whether the check actually ran. False on a missing key, network
  // failure, timeout, or non-OK response — every caller MUST treat
  // checked:false the same as "not flagged" (fail open). A broken
  // moderation call must never be able to block someone from commenting,
  // messaging, or uploading — only a genuine, confirmed flag does that.
  checked: boolean;
  flagged: boolean;
  categories: string[];
}

const UNCHECKED: ModerationResult = { checked: false, flagged: false, categories: [] };

export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const trimmed = text.trim();
  if (!apiKey || !trimmed) return UNCHECKED;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // omni-moderation-latest covers the standard OpenAI policy
      // categories (hate, harassment, violence, sexual content — including
      // sexual content involving minors — and self-harm), which is the
      // real basis this checks against; it isn't a lookup against any
      // specific country's legal code.
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: trimmed.slice(0, 8000),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("Moderation API call failed:", res.status, await res.text().catch(() => ""));
      return UNCHECKED;
    }

    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return UNCHECKED;

    const categories = Object.entries(result.categories || {})
      .filter(([, flagged]) => flagged === true)
      .map(([category]) => category);

    return { checked: true, flagged: Boolean(result.flagged), categories };
  } catch (err) {
    console.error("Moderation check failed (failing open — content proceeds unflagged):", err);
    return UNCHECKED;
  } finally {
    clearTimeout(timeout);
  }
}
