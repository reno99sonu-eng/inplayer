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
// "Transparent" per Reno's request means the ENTIRE screen becomes a
// translucent color-gradient wash — not a boxed card floating over a dim
// backdrop (that read as "a small popup," per his follow-up feedback).
// There's no panel, no border, no card background anywhere here: the
// gradient itself covers edge-to-edge and the real page stays dimly
// visible underneath it (backdrop-blur, not a solid color), with the
// icon/headline/button sitting directly on that wash. Themed with
// light:/dark: variants so it blends with the site's own gradient
// language in both modes instead of one flat color.
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
      className="fixed inset-0 z-[99998] flex items-center justify-center overflow-y-auto p-6 animate-announcement-fade-in"
    >
      {/* The gradient wash itself IS the takeover — no card, no border, no
          panel background. Multiple translucent gradient layers stacked
          edge-to-edge across the whole viewport, blurred so the real page
          stays dimly visible underneath instead of being hidden behind a
          flat color. */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#04060F]/90 via-[#1a0f05]/85 to-[#04060F]/90 light:from-[#F4ECDA]/90 light:via-[#F7E6C8]/85 light:to-[#F4ECDA]/90 backdrop-blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.28),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(255,196,64,0.22),transparent_55%),radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.12),transparent_60%)] light:bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.22),transparent_55%),radial-gradient(circle_at_80%_75%,rgba(255,196,64,0.28),transparent_55%),radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent_60%)]" />

      {/* Honeycomb texture across the whole screen, matching the site's own
          light/dark texture convention, instead of a boxed-in panel. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] light:opacity-[0.14]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 24px 24px, rgba(255,176,59,0.9) 1.5px, transparent 1.5px)",
          backgroundSize: "44px 44px",
        }}
      />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Close announcement"
        className="fixed right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 light:border-black/15 bg-white/10 light:bg-black/5 text-white light:text-slate-700 backdrop-blur-md transition hover:bg-white/20 light:hover:bg-black/10"
      >
        <X size={17} />
      </button>

      <div className="relative flex max-w-lg flex-col items-center px-4 text-center animate-announcement-pop-in">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-[0_10px_30px_rgba(249,115,22,0.45)]">
          <Megaphone size={24} className="text-white" />
        </div>

        <h2 className="mt-6 text-2xl font-black leading-snug text-white light:text-slate-900 sm:text-3xl">
          {text}
        </h2>

        {linkUrl ? (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="animate-announcement-flicker group relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3.5 text-sm font-black text-slate-950 shadow-[0_15px_35px_rgba(249,115,22,0.45)] transition-transform hover:scale-105 active:scale-100"
          >
            Explore Now
            <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 light:border-black/15 bg-white/10 light:bg-black/5 px-6 py-2.5 text-sm font-bold text-white light:text-slate-800 backdrop-blur-md transition hover:bg-white/20 light:hover:bg-black/10"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}
