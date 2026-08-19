"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { hideFloatingLaunchers } from "@/app/lib/siteDomain";

// 13KB modal — only loaded when the user actually clicks the button
const AIStudioModal = dynamic(() => import("./AIStudioModal"), { ssr: false });

// Previously this component was only ever mounted on the homepage
// (app/page.tsx used to render it directly), so it never appeared anywhere
// else in the app at all. Now it's mounted once, site-wide, in
// SiteChrome.tsx — bottom-right on EVERY page, homepage included. It was
// briefly hidden on the homepage in favour of a hamburger entry; Reno asked
// for the homepage back exactly as it was, so the orb shows there again and
// the hamburger "AI Studio" entry has been removed. Only the Support Desk
// launcher lives in the hamburger now (see SupportChatWidget.tsx).
//
// SCOPE: the InPlayer HOMEPAGE ONLY — pathname exactly "/". It was briefly
// mounted site-wide, which put it on Hammart, the Sponsorship panel and
// every immersive screen; Reno asked for it back on the homepage alone.
// The check is an exact match rather than a prefix so it can't leak onto
// /shop, /sponsorships or anything else.
//
// It stays mounted (rather than being conditionally rendered by
// SiteChrome) so this one rule lives in one place — the component decides
// where it belongs, no caller has to know.
export default function FloatingAIButton() {
  const pathname = usePathname();
  const suppressed = pathname !== "/" || hideFloatingLaunchers(pathname);

  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const footer = document.querySelector("footer");

      if (!footer) return;

      const rect = footer.getBoundingClientRect();

      setHidden(rect.top < window.innerHeight);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hooks above always run (they must — a conditional hook would break the
  // rules of hooks); only the rendered output is suppressed.
  if (suppressed) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`
            fixed
            bottom-20
            right-4
            z-[96]
            lg:bottom-6
            lg:right-6
            flex
            h-14
            w-14
            lg:h-16
            lg:w-16
            items-center
            justify-center
            rounded-full
            border
            border-orange-400/20
            light:border-orange-400/50
            bg-gradient-to-br
            from-[#1B2435]
            to-[#0B1020]
            light:from-[#FDF8EC]
            light:to-[#F0E3C6]
            shadow-[0_0_40px_rgba(255,170,0,0.35)]
            light:shadow-[0_0_35px_rgba(234,88,12,0.25)]
            transition-all
            duration-500
            hover:scale-110
            ${
              hidden
                ? "translate-y-32 opacity-0 pointer-events-none"
                : "translate-y-0 opacity-100"
            }
          `}
      >
        <span className="text-2xl text-amber-300 light:text-orange-500">✦</span>
      </button>

      <AIStudioModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
