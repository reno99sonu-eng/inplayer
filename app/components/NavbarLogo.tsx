"use client";

import { useRouter } from "next/navigation";

// The brand mark in the top navbar (and, via the same two PNGs, the
// hamburger drawer's own header — see Navbar.tsx). No animation: just the
// full INPLAYER lockup, always visible, clickable straight back to the
// homepage.
//
// Two flat images, background already removed, swapped by theme with the
// same `light:` pattern used elsewhere in the app (see app/page.tsx):
// inplayer-mark-dark.png keeps the wordmark white for InPlayer's dark
// base; inplayer-mark-light.png recolors that same wordmark to the app's
// own light-theme text tone so it stays legible on the cream background.
// The tricolor mark itself is untouched in both — only the asset each
// theme shows changes, never the file itself.
export default function NavbarLogo() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/")}
      aria-label="INPLAYER — Home"
      className="flex items-center select-none transition-transform duration-300 hover:scale-[1.03] active:scale-95"
    >
      <img
        src="/logos/inplayer-mark-dark.png"
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
