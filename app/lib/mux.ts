import Mux from "@mux/mux-node";

// A single shared Mux client, configured from the keys in .env.local.
// Any API route that needs to create uploads or manage assets imports
// this instead of creating its own client each time.
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export default mux;