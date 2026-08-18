"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye } from "lucide-react";
import { getSiteDomain } from "@/app/lib/siteDomain";

// "Are you still there?" — shown after a long stretch with no interaction
// at all from the visitor (no tap, click, key, scroll, or pointer move).
//
// Scoped to the InPlayer domain only, via the shared getSiteDomain()
// helper — the same per-panel convention the rest of this app follows
// (see app/lib/siteDomain.ts, MaintenanceGate, AnnouncementBanner). It
// deliberately does NOT run on Hammart (/shop) or Sponsorship
// (/sponsorships): being parked on a product page or a campaign form for
// half an hour while you think, compare prices, or fill in KYC details is
// completely normal and does not deserve an interruption, whereas a
// watch/browse session idling that long usually means nobody is there.
//
// What it deliberately does NOT do: it does not pause or stop anything,
// and it does not block the page — the dialog can be dismissed with the
// button, Escape, or simply by interacting with the page behind it. It is
// a check-in, not a gate.
const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

// Chosen to cover every way a real person signals presence. Note that
// "mousemove" alone is not enough (a phone never fires it) and "touchstart"
// alone is not enough (a desktop never fires it) — this needs both plus
// scroll/keyboard to avoid false positives on either kind of device.
// All registered passive, so none of them can delay scrolling or input.
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "mousedown",
  "mousemove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
  "touchmove",
  "focus",
];

export default function IdleViewerPrompt() {
  const pathname = usePathname();
  const isInPlayerDomain = getSiteDomain(pathname) === "inplayer";

  const [prompted, setPrompted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read inside the activity handler so it never has to be re-registered
  // when `prompted` changes — re-registering ten listeners on every state
  // change would be needless churn on a component that lives for the whole
  // session.
  const promptedRef = useRef(false);

  useEffect(() => {
    promptedRef.current = prompted;
  }, [prompted]);

  const dismiss = useCallback(() => {
    setPrompted(false);
    promptedRef.current = false;
  }, []);

  useEffect(() => {
    // Not on Hammart/Sponsorship (see the note above). Returning early also
    // means zero listeners and zero timers are attached on those routes.
    if (!isInPlayerDomain) return;

    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const arm = () => {
      clear();
      timerRef.current = setTimeout(() => {
        // Never interrupt a visitor who has the tab in the background —
        // they haven't "gone idle" in any meaningful sense, they're just
        // elsewhere, and a dialog waiting for them on return is noise.
        // Re-arm instead and check again next cycle.
        if (typeof document !== "undefined" && document.hidden) {
          arm();
          return;
        }
        setPrompted(true);
        promptedRef.current = true;
      }, IDLE_LIMIT_MS);
    };

    const onActivity = () => {
      // While the dialog is up, deliberately ignore activity: dismissing is
      // an explicit choice (button / Escape), so a stray pointermove from
      // brushing the mouse can't silently close it before it's been read.
      if (promptedRef.current) return;
      arm();
    };

    arm();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    return () => {
      clear();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [isInPlayerDomain]);

  // Escape closes it, matching every other dismissible overlay in the app.
  useEffect(() => {
    if (!prompted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompted, dismiss]);

  if (!isInPlayerDomain || !prompted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-prompt-title"
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm light:bg-black/40"
      onClick={dismiss}
    >
      <div
        // Stops a click inside the card from bubbling up to the backdrop's
        // dismiss handler above.
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl border border-white/10 light:border-black/10 bg-[#0b1220] light:bg-[#FBF6EA] p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15">
          <Eye size={26} className="text-orange-400 light:text-orange-600" />
        </div>

        <h2
          id="idle-prompt-title"
          className="mt-4 text-xl font-black tracking-tight text-white light:text-slate-900"
        >
          Still there?
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">
          You&apos;ve been away for a little while. Tap below and we&apos;ll
          pick up right where you left off.
        </p>

        <button
          type="button"
          onClick={dismiss}
          autoFocus
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.25)] transition-transform duration-300 hover:-translate-y-0.5 active:scale-95"
        >
          I&apos;m still watching
        </button>
      </div>
    </div>
  );
}
