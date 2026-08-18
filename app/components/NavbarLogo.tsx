"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSiteDomain } from "@/app/lib/siteDomain";

// The brand mark in the top navbar (and, via the same two PNGs, the
// hamburger drawer's own header — see Navbar.tsx). No animation of its
// own: just the full lockup, always visible, clickable back to the home
// screen of whichever product the visitor is currently in.
//
// Two flat images, background already removed, swapped by theme with the
// same `light:` pattern used elsewhere in the app (see app/page.tsx):
// inplayer-mark-dark.png keeps the wordmark white for InPlayer's dark
// base; inplayer-mark-light.png recolors that same wordmark to the app's
// own light-theme text tone so it stays legible on the cream background.
// The tricolor mark itself is untouched in both — only the asset each
// theme shows changes, never the file itself.
//
// ── Hammart branding ────────────────────────────────────────────────
// Hammart (/shop/*) is its own storefront brand, so it shows its own Ham
// Mart lockup here instead of the InPlayer one, and the logo links to
// /shop rather than /. Detected with the shared getSiteDomain() helper
// (app/lib/siteDomain.ts) — the same one MaintenanceGate, the
// announcement banner and the admin panel all use to decide which of the
// three products a URL belongs to — so this can never drift out of sync
// with the rest of the per-domain behavior.
//
// Because this component is rendered by BOTH the mobile and the desktop
// navbar rows, doing the swap here covers every screen size at once with
// no duplicated markup.
//
// The Ham Mart artwork is a single full-color badge that reads correctly
// on both the dark and the cream background, so unlike the InPlayer pair
// there is only one asset and no theme swap. If it is ever missing from
// public/logos, onError below quietly falls back to the InPlayer mark
// rather than leaving a broken image in the navbar.
const HAMMART_LOGO_SRC = "/logos/hammart-logo.png";
const INPLAYER_FALLBACK_SRC = "/logos/inplayer-mark-dark.png";

export default function NavbarLogo() {
  const router = useRouter();
  const pathname = usePathname();
  const isHammart = getSiteDomain(pathname) === "hammart";
  const [hammartLogoFailed, setHammartLogoFailed] = useState(false);

  if (isHammart && !hammartLogoFailed) {
    return (
      <button
        type="button"
        onClick={() => router.push("/shop")}
        aria-label="Ham Mart — Shop home"
        className="flex items-center select-none transition-transform duration-300 hover:scale-[1.03] active:scale-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- matches the
            plain <img> the InPlayer marks below already use, so both brands
            size and swap identically. */}
        <img
          src={HAMMART_LOGO_SRC}
          alt="Ham Mart"
          draggable={false}
          onError={() => setHammartLogoFailed(true)}
          className="h-9 md:h-10 lg:h-11 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)] light:drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      aria-label="INPLAYER — Home"
      className="flex items-center select-none transition-transform duration-300 hover:scale-[1.03] active:scale-95"
    >
      <img
        src={INPLAYER_FALLBACK_SRC}
        alt="INPLAYER"
        draggable={false}
        className="light:hidden h-9 md:h-10 lg:h-11 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
      />
      <img
        src="/logos/inplayer-mark-light.png"
        alt="INPLAYER"
        draggable={false}
        className="hidden light:block h-9 md:h-10 lg:h-11 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
      />
    </button>
  );
}
