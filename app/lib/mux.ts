import Mux from "@mux/mux-node";

// A single shared Mux client, configured from the keys in .env.local.
// Any API route that needs to create uploads, manage assets, or verify
// webhooks imports this instead of creating its own client each time.
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  webhookSecret: process.env.MUX_WEBHOOK_SECRET,
});

// Pulls the human-readable message(s) out of a Mux API error, e.g.
// "Live streams are unavailable on the free plan" or "Free plan is limited
// to 10 assets...". Surfacing these to the UI turns plan-limit failures
// from mystery errors into something actionable. Returns null for
// non-Mux/unknown errors.
export function muxErrorMessages(err: unknown): string | null {
  const messages = (
    err as { error?: { error?: { messages?: unknown } } }
  )?.error?.error?.messages;

  if (Array.isArray(messages) && messages.length > 0) {
    return messages.filter((m) => typeof m === "string").join(" ");
  }

  return null;
}

export default mux;