"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

// Android package name — see INPLAYER_Android/android/app/build.gradle.kts.
const ANDROID_PACKAGE = "com.inplayer.app";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const DISMISS_KEY = "inplayer-app-banner-dismissed";

// No cross-tab subscription needed — this is a one-time read of a value
// only this component ever writes, from its own dismiss button.
function subscribeNever() {
  return () => {};
}
function getStoredDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Storage unavailable (private mode, blocked) — show the banner rather
    // than silently hide a real feature over a read failure.
    return false;
  }
}
// SSR has no localStorage at all — stay hidden server-side (and for the
// very first client render, before hydration reconciles the real value)
// rather than flash the banner open for a frame on every load.
function getServerSnapshotDismissed() {
  return true;
}

// A slim, dismissible "open this in the app" prompt for Android visitors —
// the same idea as YouTube's mobile-web banner: it OFFERS the app, it never
// forces it. Tapping "Open" is the only thing that ever navigates anywhere;
// closing it (or just not tapping Open) leaves the person on the website,
// exactly as normal, and that choice is remembered so it doesn't nag again.
//
// Deliberately Android-only (there is no iOS app), and deliberately a
// banner rather than an automatic redirect: a page load silently trying to
// hand off to a native app is both unreliable (browsers block programmatic
// top-level navigation without a real tap, for the same reason they block
// popups) and exactly the pattern people find naggy — a visible, one-tap
// choice is the whole point of the pattern this is copying.
export default function AppOpenBanner({
  isAndroidMobile,
}: {
  isAndroidMobile: boolean;
}) {
  const pathname = usePathname();
  const storedDismissed = useSyncExternalStore(
    subscribeNever,
    getStoredDismissed,
    getServerSnapshotDismissed
  );
  // The click handler below sets this directly (a normal event-handler
  // setState, not one driven by an effect) so the banner disappears the
  // instant it's tapped, without waiting on a re-render to re-read storage.
  const [justDismissed, setJustDismissed] = useState(false);

  if (!isAndroidMobile || storedDismissed || justDismissed) return null;

  function dismiss() {
    setJustDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best-effort — worst case this asks again next visit.
    }
  }

  function openApp() {
    // The Android app's MainActivity already declares an intent-filter for
    // https://inplayer.in (see AndroidManifest.xml's App Links block) — the
    // package is what makes Chrome resolve straight to a specific app
    // instead of just re-opening the same page in the browser it's already
    // in (which is what a plain https:// link does when you're already on
    // that origin — the exact reason "Open in app" links use the
    // intent:// form instead of a normal href). If the app isn't
    // installed, Chrome falls through to the Play Store automatically.
    const target = `${window.location.origin}${pathname || "/"}`;
    const intentUrl =
      `intent://${target.replace(/^https?:\/\//, "")}` +
      `#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
      `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    window.location.href = intentUrl;
  }

  return (
    <div className="sticky top-0 z-[60] flex items-center gap-3 border-b border-orange-500/20 bg-[#0b1220] px-3 py-2 light:border-orange-500/25 light:bg-[#FBF6EA]">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny fixed static asset, not worth next/image here */}
        <img src="/icon.png" alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-white light:text-slate-900">
          Get the InPlayer app
        </p>
        <p className="truncate text-[10.5px] text-slate-400 light:text-slate-600">
          A faster, smoother way to watch
        </p>
      </div>
      <button
        type="button"
        onClick={openApp}
        className="flex-shrink-0 rounded-lg bg-orange-500 px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-orange-600"
      >
        Open
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white light:text-slate-500 light:hover:bg-black/5 light:hover:text-slate-900"
      >
        <X size={16} />
      </button>
    </div>
  );
}
