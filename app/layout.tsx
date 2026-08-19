import type { Metadata } from "next";
import "./amplify-config";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsProvider } from "./components/settings/SettingsProvider";
import AuthProvider from "./components/auth/AuthProvider";
import SiteChrome from "./components/SiteChrome";
import ChunkErrorRecovery from "./components/ChunkErrorRecovery";
import { getPlatformSettings } from "./lib/platformSettings";
import type { DomainMaintenanceFields } from "./lib/siteDomain";
import { headers } from "next/headers";
import { isSearchCrawler } from "@/app/lib/searchCrawlers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  // Base URL every relative/og/canonical link in the app resolves against.
  // Without this, Next.js falls back to guessing from the request, which
  // is exactly how the same page can end up looking like it lives at more
  // than one address (inplayer.in vs the Vercel alias domains) with no
  // single source of truth — part of the fix for Search Console's
  // "Duplicate without user-selected canonical" report (see middleware.ts
  // for the other half: redirecting the known alias domains to this one).
  metadataBase: new URL("https://inplayer.in"),
  // `template` lets every other page just set its own short title (e.g.
  // generateMetadata on a watch page returning the real video title) and
  // automatically get "<that title> | INPLAYER" — consistent branding on
  // every single result Google shows for this site, without repeating
  // "INPLAYER" by hand on every page. `default` is only used by pages that
  // don't set their own title at all.
  title: {
    default: "INPLAYER — Stream Videos, Live TV, Shorts & Shop Online",
    template: "%s | INPLAYER",
  },
  description:
    "INPLAYER is an all-in-one entertainment platform — stream original videos and live shows, watch Raftaar shorts, discover creators, and shop, all in one place.",
  applicationName: "INPLAYER",
  // Google Search Console ownership proof. Next renders this as
  //   <meta name="google-site-verification" content="..." />
  // in every page's <head>, which is what Google's verifier looks for.
  //
  // Not a secret — it proves control of the domain, it doesn't grant
  // access to anything. It has to STAY here permanently: Google re-checks
  // it periodically and silently unverifies the property if it disappears,
  // taking the sitemap and indexing reports with it.
  //
  // Google's verifier fetches this from outside India, so it depends on
  // the "google-site-verification" entry in app/lib/searchCrawlers.ts to
  // get past the geo-block. Before that exemption existed, verifying this
  // domain by HTML tag was impossible — the verifier only ever saw the
  // "Region Not Available" page, which has no such tag in it.
  verification: {
    google: "mZqMR3AMeJ64HxrdTP96XmrzRCCTtJ5L-ojAuUbWtuc",
  },
  // Also referenced by the JSON-LD Organization/WebSite block below, which
  // is what actually helps Google tell this INPLAYER apart from unrelated
  // companies/products that happen to share the name.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "INPLAYER",
    title: "INPLAYER — Stream Videos, Live TV, Shorts & Shop Online",
    description:
      "Stream original videos and live shows, watch Raftaar shorts, discover creators, and shop — all in one place.",
    images: [
      {
        url: "/logos/inplayer-full.png",
        width: 1200,
        height: 630,
        alt: "INPLAYER",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "INPLAYER — Stream Videos, Live TV, Shorts & Shop Online",
    description:
      "Stream original videos and live shows, watch Raftaar shorts, discover creators, and shop — all in one place.",
    images: ["/logos/inplayer-full.png"],
  },
};

// Tells Google (and any other engine that reads schema.org data) that
// "INPLAYER" the word and "inplayer.in" the URL refer to the same one real
// entity — the actual mechanism behind a Knowledge Panel / correct entity
// match for a brand-name search, not something a title tag alone can do.
// Deliberately omits `sameAs` (links to official social profiles) — the
// Instagram/X icons in Footer.tsx aren't wired to real URLs yet (plain
// decorative buttons, no href), and a wrong/guessed profile link in
// structured data would actively mislead Google rather than help. Add
// `sameAs: [...]` here the moment those real profile URLs exist.
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "INPLAYER",
      legalName: "Homox Prime Pvt Ltd",
      url: "https://inplayer.in",
      logo: "https://inplayer.in/logos/inplayer-full.png",
      description:
        "INPLAYER is an all-in-one entertainment platform — stream original videos and live shows, watch shorts, discover creators, and shop, all in one place.",
    },
    {
      "@type": "WebSite",
      name: "INPLAYER",
      url: "https://inplayer.in",
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetched server-side so MaintenanceGate already knows the real
  // maintenance-mode state in the very first server-rendered HTML, instead
  // of only finding out after its own client-side fetch resolves. That
  // client-only fetch used to mean the real site (navbar, homepage, bottom
  // nav) rendered normally for a brief window on every fresh page load,
  // then got swapped for the maintenance splash once the fetch landed — a
  // flash that's easy to miss on a fast desktop connection but stretches
  // out (and reads as "maintenance mode isn't working") on a slower mobile
  // connection, which is exactly the bug this fixes. getPlatformSettings()
  // already fails open to defaults (maintenance off) on any read error, so
  // this can't accidentally lock real visitors out over a transient issue.
  //
  // Fetches all three panels' maintenance fields, not just one — the root
  // layout has no pathname access (Next.js root layouts render above the
  // router), so it can't know here whether this request is for InPlayer,
  // Hammart, or Sponsorship. SiteChrome (the first pathname-aware point in
  // the tree, via usePathname()) and MaintenanceGate itself pick out the
  // one domain that actually matters for the current page.
  const settings = await getPlatformSettings();
  const initialMaintenance: DomainMaintenanceFields = {
    inplayerMaintenanceMode: settings.inplayerMaintenanceMode,
    inplayerMaintenanceMessage: settings.inplayerMaintenanceMessage,
    hammartMaintenanceMode: settings.hammartMaintenanceMode,
    hammartMaintenanceMessage: settings.hammartMaintenanceMessage,
    sponsorshipMaintenanceMode: settings.sponsorshipMaintenanceMode,
    sponsorshipMaintenanceMessage: settings.sponsorshipMaintenanceMessage,
  };

  // Vercel's edge network sets x-vercel-ip-country on every request based
  // on the real connecting IP. When it's absent (local dev, non-Vercel
  // host), default to allowed so development isn't blocked.
  //
  // Search crawlers and link-preview bots are allowed regardless of
  // country, and MUST be checked here as well as in middleware.ts. The
  // middleware decides whether the request reaches this page at all; this
  // line decides what GeoGate paints once it does. Exempting a crawler in
  // only one of the two places still leaves it looking at "Sorry, we're not
  // available in your region yet" — the middleware would let Googlebot in,
  // and then geoAllowed=false would have GeoGate render the block screen
  // for it anyway. See app/lib/searchCrawlers.ts.
  const hdrs = await headers();
  const ipCountry = hdrs.get("x-vercel-ip-country") || "IN";
  const geoAllowed = ipCountry === "IN" || isSearchCrawler(hdrs.get("user-agent"));

  return (
    <html lang="en">
      <body
  className={`
    ${jakarta.className}
    bg-background
    text-foreground
    transition-colors
    duration-300
  `}
>
{/* Structured data (see ORGANIZATION_JSON_LD above) — a static, inert
    JSON blob, same "runs independent of React ever mounting" reasoning as
    the two plain-JS scripts below, just with nothing to execute. */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
/>
{/* Applies the correct light/dark class to <html> BEFORE first paint —
    must stay in sync with ThemeProvider.tsx's own resolveTheme() (same
    "inplayer-theme" localStorage key, same 6:00-17:59 local-time daytime
    window). Without this running, <html> carries no theme class until
    ThemeProvider's client-side effect fires after hydration, so every
    page — including the splash screen — briefly renders in the unprefixed
    default (dark) styling and then visibly snaps to light on a
    daytime/light-preference visit. This script was accidentally left
    wrapped in a JSX comment (dead code that never rendered at all), which
    was the actual cause of the dark-then-light flash Reno reported on the
    splash logo — this is a real bug fix, not a re-decoration. */}
<script
  dangerouslySetInnerHTML={{
    __html:
      '(function(){try{var t=localStorage.getItem("inplayer-theme");var r=(t==="light"||t==="dark")?t:((new Date().getHours()>=6&&new Date().getHours()<18)?"light":"dark");document.documentElement.classList.add(r);}catch(e){document.documentElement.classList.add("dark");}})();',
  }}
/>
{/* Belt-and-suspenders failsafe for the splash curtain (see
    SplashScreen.tsx, id="app-splash-curtain" and id="app-splash-greeting").
    SplashScreen normally dismisses itself — and fills in its "Good
    Morning/Afternoon/Evening/Night" greeting — via React useEffects that
    run ~2s after mount. That's the primary, animated path and is left
    completely alone. But that path depends on React actually getting a
    turn to run those effects, and real-world reports (splash stuck open
    indefinitely, confirmed with a clean console/network — no crash, no
    hung request, plain window.setTimeout proven to fire fine in the same
    browser) show a small number of visits where, for reasons that resisted
    every remote-diagnosis avenue available (no reproducible crash, no
    failing request, no redirect loop, no stuck data fetch), those
    effect-driven updates never visibly happen. This script is plain,
    framework-free JS baked directly into the initial HTML — it runs
    independent of React/hydration/effects ever running at all, so it
    can't be affected by whatever is blocking the primary path:

    1. As soon as the document has finished parsing, if the greeting
       paragraph is still empty (React's own effect hasn't filled it in
       yet), this writes the plain time-of-day greeting into it — no
       signed-in user's name (that part genuinely does need React/auth
       state), but the "Good Morning" etc. text people actually see. If
       React's effect DOES run afterward, its own render simply overwrites
       this with the fuller version — no conflict either way.
    2. ~3s after the document starts loading, if the curtain is still in
       the DOM (normal case: React has already removed it by ~2s, so this
       finds nothing and is a no-op), this force-hides it, dispatches the
       splashDismissed event (so the mobile navbar logo animation still
       plays), and restores page scrolling — trading the graceful fade for
       "the site is usable" as the outcome that actually matters. The 3s
       timeout is deliberately longer than the normal splash path (~1.5s)
       to avoid racing it, while still being short enough to rescue a
       genuinely stuck splash. */}
<script
  dangerouslySetInnerHTML={{
    __html:
      '(function(){function g(){try{var e=document.getElementById("app-splash-greeting");if(e&&!e.textContent){var h=new Date().getHours();var w=(h>=5&&h<12)?"Morning":(h>=12&&h<17)?"Afternoon":"Evening";e.textContent="Good "+w;}}catch(err){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",g);}else{g();}setTimeout(function(){try{var el=document.getElementById("app-splash-curtain");if(el){el.style.transition="none";el.style.opacity="0";el.style.pointerEvents="none";el.style.display="none";try{window.dispatchEvent(new CustomEvent("splashDismissed"));}catch(ev){}}document.body.style.overflow="";document.documentElement.style.overflow="";}catch(e){}},3000);})();',
  }}
/>
<ChunkErrorRecovery />
<AuthProvider>
  <SettingsProvider>
    <ThemeProvider>
      <SiteChrome
        initialMaintenance={initialMaintenance}
        initialGeoAllowed={geoAllowed}
      >
        {children}
      </SiteChrome>
    </ThemeProvider>
  </SettingsProvider>
</AuthProvider>
      </body>
    </html>
  );
}
