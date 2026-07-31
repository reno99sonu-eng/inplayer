// Banned-item classifier for Hammart product listings (alcohol, tobacco,
// vapes, sex toys/adult items, weapons, drugs, etc.) — a real, separate
// check from app/lib/moderation.ts's moderateText(), which only screens
// for OpenAI's built-in policy categories (hate, violence, sexual content,
// self-harm) and has no concept of "is this a banned marketplace item."
// Uses the same already-configured OPENAI_API_KEY (no new credential to
// set up), but calls the Chat Completions API with a custom classification
// prompt instead of the Moderation endpoint, since there's no off-the-
// shelf category for "alcohol" or "sex toy."
//
// Same fail-open policy as every other moderation check in this codebase:
// a missing key, network error, timeout, or malformed response must never
// block a real vendor from listing a legitimate product — it just means
// this particular listing goes out unchecked, same as moderateText()'s
// UNCHECKED result.
const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 8000;

export interface BannedItemResult {
  checked: boolean;
  banned: boolean;
  category: string | null;
  reason: string | null;
}

export const UNCHECKED_BANNED_ITEM: BannedItemResult = {
  checked: false,
  banned: false,
  category: null,
  reason: null,
};

const SYSTEM_PROMPT = `You are a marketplace listing safety classifier for an Indian e-commerce platform called Hammart. Given a product's title, description, and category, decide whether it violates the platform's banned-items policy.

Banned categories: alcohol, tobacco/cigarettes/vapes/e-cigarettes, sex toys or other adult/sexual products, illegal drugs or drug paraphernalia, firearms/ammunition/weapons/explosives, counterfeit or pirated goods, live animals, human body parts or organs, prescription medicines without a license, currency or gambling items.

Respond ONLY with a compact JSON object of the exact shape:
{"banned": true|false, "category": "alcohol"|"tobacco"|"adult"|"drugs"|"weapons"|"counterfeit"|"animals"|"medical"|"other"|null, "reason": "short explanation or null"}

If the listing is not clearly one of these banned categories, respond {"banned": false, "category": null, "reason": null}. Do not flag ordinary legal products (electronics, clothing, food, handicrafts, books, etc.) just because they could theoretically be misused.`;

export async function checkBannedProduct(params: {
  title: string;
  description: string;
  category: string;
}): Promise<BannedItemResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const title = params.title.trim();
  if (!apiKey || !title) return UNCHECKED_BANNED_ITEM;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Title: ${title.slice(0, 300)}\nCategory: ${params.category.slice(0, 100)}\nDescription: ${params.description.trim().slice(0, 2000)}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("Hammart banned-item check failed:", res.status, await res.text().catch(() => ""));
      return UNCHECKED_BANNED_ITEM;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return UNCHECKED_BANNED_ITEM;

    const parsed = JSON.parse(content) as { banned?: boolean; category?: string | null; reason?: string | null };
    return {
      checked: true,
      banned: Boolean(parsed.banned),
      category: parsed.category || null,
      reason: parsed.reason || null,
    };
  } catch (err) {
    console.error("Hammart banned-item check failed (failing open — listing proceeds unchecked):", err);
    return UNCHECKED_BANNED_ITEM;
  } finally {
    clearTimeout(timeout);
  }
}
