"use client";

import { useEffect, useState } from "react";
import { X, Megaphone, ArrowUpRight } from "lucide-react";
import { usePlatformSettings } from "@/app/hooks/usePlatformSettings";

const DISMISS_KEY_PREFIX = "inplayer-announcement-dismissed:";

// Real site-wide takeover, toggled from Admin Panel -> Platform Settings —
// e.g. "Paid memberships are live" or a scheduled-downtime notice, shown
// once as a full-screen premium overlay rather than a thin top strip.
// Keyed by the announcement's own text + link so a dismissal only ever
// hides THAT specific message: change either field in Settings and every
// visitor sees the new one again, even if they dismissed an older one.
//
// "Transparent" per Reno's request means a translucent, blurred backdrop
// (the real page stays dimly visible underneath, same pattern as the
// address-picker modal) rather than a solid opaque takeover — and the
// panel itself uses the same honeycomb/gradient language as the rest of
// the site so it reads as part of InPlayer, not a bolted-on popup, in
// both themes.
export default function AnnouncementBanner() {
  const { settings } = usePlatformSettings();
  const [dismissed, setDismissed] = useState(false);

  const text = settings?.announcementText || "";
  const linkUrl = settings?.announcementLinkUrl?.trim() || "";
  const active = Boolean(settings?.announcementEnabled) && text.trim().length > 0;
  const dismissKey = DISMISS_KEY_PREFIX + text + "|" + linkUrl;

  useEffect(() => {
    (() => {
      if (!active) return;
      try {
        setDismissed(localStorage.getItem(dismissKey) === "1");
      } catch {
        setDismissed(false);
      }
    })();
  }, [active, dismissKey]);

  const visible = active && !dismissed;

  // Lock page scroll while the takeover is up, same pattern as
  // SplashScreen/LocationMapPicker — restored on dismiss or unmount so a
  // fast route change never leaves scrolling permanently disabled.
  useEffect(() => {
    if (!visible) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {
      /* ignore — dismissal just won't persist across reloads */
    }
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Announcement"
      className="fixed inset-0 z-[99998] flex items-center justify-center overflow-y-auto p-4 animate-announcement-fade-in"
    >
      {/* Translucent, blurred backdrop — the real site stays visible (and
          dim) underneath, not hidden behind a solid color. Themed to match
          each mode's own background language instead of one flat black. */}
      <div className="absolute inset-0 bg-[#04060F]/80 light:bg-[#F4ECDA]/85 backdrop-blur-xl" />

      {/* Ambient premium glow mesh — same orange/cyan ambient-glow language
          used on the homepage background, just concentrated here. */}
      <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-orange-500/20 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[420px] w-[420px] rounded-full bg-cyan-500/15 light:bg-amber-300/20 blur-[140px]" />

      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 light:border-black/10 bg-white/[0.06] light:bg-white/70 p-7 text-center shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl animate-announcement-pop-in sm:p-9">
        {/* Subtle honeycomb texture inside the card, matching the site's
            own light/dark texture convention. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] light:opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20px 20px, rgba(255,176,59,0.9) 1.5px, transparent 1.5px)",
            backgroundSize: "38px 38px",
          }}
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Close announcement"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 light:border-black/15 bg-white/10 light:bg-black/5 text-white light:text-slate-700 transition hover:bg-white/20 light:hover:bg-black/10"
        >
          <X size={15} />
        </button>

        <div className="relative">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_10px_25px_rgba(249,115,22,0.4)]">
            <Megaphone size={22} className="text-white" />
          </div>

          <h2 className="mt-5 text-xl font-black leading-snug text-white light:text-slate-900 sm:text-2xl">
            {text}
          </h2>

          {linkUrl ? (
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              className="animate-announcement-flicker group relative mt-7 inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-7 py-3 text-sm font-black text-slate-950 shadow-[0_15px_35px_rgba(249,115,22,0.45)] transition-transform hover:scale-105 active:scale-100"
            >
              Explore Now
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={dismiss}
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 light:border-black/15 bg-white/10 light:bg-black/5 px-6 py-2.5 text-sm font-bold text-white light:text-slate-800 transition hover:bg-white/20 light:hover:bg-black/10"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
