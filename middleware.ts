import { NextRequest, NextResponse } from "next/server";

// ──────────────────────────────────────────────────────────────────────
// INDIA-ONLY GEO-RESTRICTION — EDGE MIDDLEWARE (Layer 1)
// ──────────────────────────────────────────────────────────────────────
// Runs at Vercel's CDN edge BEFORE any page is served. Vercel attaches
// the `x-vercel-ip-country` header to every request based on the real
// connecting IP — this can't be spoofed from the client side. A VPN that
// routes through a non-Indian server gets blocked here instantly, before
// any JS/HTML is even sent.
//
// This is the first and most efficient defense layer: ~0ms overhead,
// zero external API calls, zero JS execution on the client.
//
// Local dev: the header doesn't exist when running `npm run dev`, so the
// middleware defaults to ALLOWING the request (you can't test geo-
// restriction locally, only on Vercel preview/production deployments).
// ──────────────────────────────────────────────────────────────────────

// Paths that should NEVER be geo-blocked:
// - /geo-blocked itself (would infinite-redirect)
// - /admin/* (admin must always be reachable, same as MaintenanceGate)
// - /_next/* (Next.js internals, static chunks, HMR websocket)
// - /api/geo/* (geo-verification API must be accessible to blocked users)
// - /api/webhooks/* (Mux and Razorpay call these directly, server-to-server
//   — there is no "visitor" to geo-check here. Mux's and Razorpay's own
//   servers are not in India, so without this exemption their callbacks
//   were getting silently rewritten to /geo-blocked instead of reaching
//   the real handler: uploads got stuck in "processing" forever (the Mux
//   webhook that flips status to "ready" never ran) and — far more
//   seriously — the Razorpay webhook is the ONLY place a payment actually
//   gets credited (see app/api/webhooks/razorpay/route.ts's own comment),
//   so this same gap could silently fail to activate memberships/payouts
//   too. Exactly the same class of bug /api/admin already hit once (see
//   the "Fix admin panel sign-in" commit) — generalizing the fix here.
// - /terms and /privacy — legal pages must be readable by non-India
//   visitors/crawlers too: Razorpay's own automated "Page Compliance
//   Check" (and Apple/Google app review, and any user checking your
//   policies before they ever set foot in India) fetches these pages from
//   servers that are NOT in India. Without this exemption they were
//   silently rewritten to /geo-blocked, so the crawler saw the "Sorry,
//   we're not available in your region" page instead of real legal text
//   and could never verify the links — this is what was causing Razorpay's
//   compliance check to keep failing even after the correct URLs were
//   entered.
// - Static files (favicon, images, etc.)
const BYPASS_PREFIXES = [
  "/geo-blocked",
  "/admin",
  "/api/admin",
  "/_next",
  "/api/geo",
  "/api/webhooks",
  "/terms",
  "/privacy",
] as const;

const BYPASS_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
]);

function shouldBypass(pathname: string): boolean {
  if (BYPASS_EXACT.has(pathname)) return true;
  for (const prefix of BYPASS_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  // Static asset extensions — images, fonts, etc.
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|css|js|map)$/i.test(pathname)) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip paths that must always be accessible
  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  // Vercel's edge network sets this header based on the real connecting
  // IP's geolocation. When running locally (no Vercel edge), the header
  // is absent — we default to allowing in that case so local dev works.
  const country = request.headers.get("x-vercel-ip-country");

  // No header = local dev or non-Vercel host → allow
  if (!country) {
    return NextResponse.next();
  }

  // India → allow
  if (country === "IN") {
    return NextResponse.next();
  }

  // Everything else → rewrite to the geo-blocked page
  const blockedUrl = request.nextUrl.clone();
  blockedUrl.pathname = "/geo-blocked";
  return NextResponse.rewrite(blockedUrl);
}

// Only run the middleware on page navigations and API routes, not on
// every single static asset request (Next.js config-level optimization).
export const config = {
  matcher: [
    // Match all paths EXCEPT Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|css|js|map)$).*)",
  ],
};
