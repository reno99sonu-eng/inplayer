import Mux from "@mux/mux-node";

// A single shared Mux client, configured from the keys in .env.local.
// Any API route that needs to create uploads, manage assets, or verify
// webhooks imports this instead of creating its own client each time.
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  webhookSecret: process.env.MUX_WEBHOOK_SECRET,
});

export default mux;