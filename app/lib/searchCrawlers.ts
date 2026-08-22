// Which user agents are robots that must be allowed past the India-only
// geo-restriction.
//
// WHY THIS EXISTS: the geo-block in middleware.ts rewrites every non-India
// request to /geo-blocked. Googlebot crawls almost entirely from US IP
// addresses, so it was receiving "Sorry, we're not available in your region
// yet" for EVERY url on the site — homepage, every video, every creator
// page. It is served as a rewrite, so the URL never changes and the
// `Disallow: /geo-blocked` line in robots.ts never applies: Google simply
// recorded that message as the real content of inplayer.in. All 150 URLs in
// the sitemap looked like the same thin error page, which is why the site
// could not rank for anything, including its own name.
//
// This is the same class of bug the geo-block already had to be patched for
// three separate times (admin sign-in, Mux/Razorpay webhooks, Razorpay's
// compliance checker, ad-network crawlers) — a non-human, non-India client
// that was never a "visitor" to geo-check in the first place.
//
// THIS IS NOT CLOAKING. Cloaking means showing a crawler different or
// better content than a human gets. This shows Googlebot exactly the page
// an Indian visitor sees — the site's real, canonical content. Google's own
// guidance for locale-adaptive sites is explicitly not to block Googlebot
// from the primary content.
//
// ON SPOOFING — READ THIS BEFORE ADDING TO THE LIST BELOW. A user agent is
// a string the client makes up. Someone outside India who sets theirs to
// contain "Googlebot" gets past the middleware AND past GeoGate's VPN/GPS
// layers, which skip themselves for the same reason. So this genuinely
// weakens the geo-restriction: before, a determined visitor needed a VPN
// (and Layers 2 and 3 would still catch it); now a header edit is enough.
//
// It is accepted deliberately, because the alternative is a site that
// cannot be found on Google at all — every geo-restricted service makes
// this same trade. But it is a real hole, so keep this list NARROW: each
// token is one more word someone can type into a header.
//
// To close it properly, stop trusting the string and verify the client:
// match the connecting IP against Google's published crawler ranges
// (developers.google.com/search/apis/ipranges/googlebot.json), or reverse-
// DNS the IP and confirm it resolves under googlebot.com / google.com.
//
// PURE MODULE — no next/*, no node built-ins — because middleware.ts runs
// on the edge runtime and GeoGate.tsx runs in the browser, and both need
// the exact same answer. Matching is case-insensitive substring, which is
// how these tokens are conventionally detected.

/** Search engines. Blocking these is what made the site invisible. */
const SEARCH_ENGINE_TOKENS = [
  // Covers Googlebot, Googlebot-Image/Video/News, and the smartphone
  // renderer (its Chrome-based UA still carries "Googlebot/2.1").
  "googlebot",
  // Search Console's own "Test Live URL" / Rich Results Test fetcher.
  // Without this, inspecting a URL in Search Console reports the blocked
  // page and there is no way to debug indexing from the console at all.
  "google-inspectiontool",
  "google-site-verification",
  "googleother",
  "storebot-google",
  "adsbot-google",
  "mediapartners-google",
  "apis-google",
  "feedfetcher-google",
  "adsense",
  "googleads",
  "google-ads",
  "bingbot",
  "bingpreview",
  "adidxbot",
  "duckduckbot",
  "yandexbot",
  "baiduspider",
  "applebot",
  // Yahoo.
  "slurp",
];

/** Link-preview fetchers — the robots that build the card you see when a
 *  link is pasted into a chat app.
 *
 *  These matter for a reason unrelated to search: when someone IN India
 *  shares an InPlayer video to WhatsApp, WhatsApp's own servers (not in
 *  India) fetch the page to build the preview. Geo-blocked, they were
 *  reading "Sorry, we're not available in your region yet" — so every
 *  shared InPlayer link showed that as its title and description instead
 *  of the video's real title and thumbnail. Same for Facebook, Instagram,
 *  X, LinkedIn and Telegram.
 *
 *  Like the crawlers above, these are servers, never a person browsing. */
const LINK_PREVIEW_TOKENS = [
  "whatsapp",
  "facebookexternalhit",
  "facebookcatalog",
  "meta-externalagent",
  "twitterbot",
  "linkedinbot",
  "telegrambot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "pinterest",
  "redditbot",
  "skypeuripreview",
  "embedly",
  "vkshare",
  "quora link preview",
  "nuzzel",
  "outbrain",
  // Apple's iMessage / Notes / Mail link previews.
  "applebot-extended",
];

const ALLOWED_BOT_TOKENS = [...SEARCH_ENGINE_TOKENS, ...LINK_PREVIEW_TOKENS];

/**
 * True when the request is a search-engine crawler or a link-preview
 * fetcher that should see the real page rather than the geo-block.
 */
export function isSearchCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ALLOWED_BOT_TOKENS.some((token) => ua.includes(token));
}
