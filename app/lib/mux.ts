import Mux from "@mux/mux-node";

// A single shared Mux client, configured from the keys in .env.local.
// Any API route that needs to create uploads, manage assets, or verify
// webhooks imports this instead of creating its own client each time.
//
// jwtSigningKey/jwtPrivateKey come from a Signing Key created in Mux
// Dashboard -> Settings -> Signing Keys (a separate credential from the
// API token above) — required for signPlaybackToken below to work. Only
// members-only video playback needs this; every other Mux feature in this
// app (uploads, thumbnails, captions) works with just the API token.
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  webhookSecret: process.env.MUX_WEBHOOK_SECRET,
  jwtSigningKey: process.env.MUX_SIGNING_KEY || null,
  jwtPrivateKey: process.env.MUX_PRIVATE_KEY || null,
});

// Issues a short-lived, single-purpose playback token for a SIGNED Mux
// playback ID (see muxSignedPlaybackId on InPlayer-Videos). This is the
// only thing that makes a members-only video's signed playback ID actually
// playable — call this ONLY after verifying (server-side, right before
// this call) that the requesting viewer is really the video's owner or an
// active paid member. Never call this speculatively or cache/reuse a token
// across viewers. Returns null if no signing key is configured yet.
export async function signPlaybackToken(signedPlaybackId: string): Promise<string | null> {
  if (!process.env.MUX_SIGNING_KEY || !process.env.MUX_PRIVATE_KEY) {
    console.error("signPlaybackToken: MUX_SIGNING_KEY/MUX_PRIVATE_KEY not configured");
    return null;
  }
  try {
    return await mux.jwt.signPlaybackId(signedPlaybackId, {
      type: "video",
      expiration: "6h",
    });
  } catch (err) {
    console.error("signPlaybackToken: signing failed:", err);
    return null;
  }
}

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