"use client";

import { useEffect } from "react";

// After every fresh deploy, the OLD JavaScript files this browser tab
// already loaded stop matching what's actually live on the server — so any
// further click that needs to fetch a NEW piece of code (a route change, a
// lazy-loaded modal, etc.) fails silently: nothing crashes loudly, buttons
// just stop doing anything and the page reads as "stuck." This is exactly
// what a visitor sees if they already had the site open across one of our
// deploys: a splash screen that never dismisses, a Publish button that
// does nothing, or a page that suddenly acts signed-out — and a manual
// browser refresh always fixes it because that fetches the current HTML
// and current JS together again, matched up correctly.
//
// This makes that recovery automatic instead of relying on a visitor
// noticing and refreshing themselves. A short cooldown (shared with
// app/global-error.tsx via the same storage key) stops this from ever
// reload-looping if the real cause turns out to be a genuine bug rather
// than a stale deploy.
export const CHUNK_RELOAD_STORAGE_KEY = "inplayer-auto-reload-at";
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_ERROR_PATTERN =
  /loading chunk|chunkloaderror|failed to fetch dynamically imported module|importing a module script failed|failed to import/i;

function looksLikeStaleChunkError(message: unknown): boolean {
  return typeof message === "string" && CHUNK_ERROR_PATTERN.test(message);
}

export function recoverFromStaleChunkOnce(message?: string) {
  // If running inside a cross-origin sandbox iframe (e.g. AdSense preview), never attempt to reload
  if (typeof window !== "undefined") {
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }
  }

  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    if (Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return;
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {
    // No storage access (private mode) — still safer to reload once than
    // leave the page stuck, just without loop protection.
  }

  // Best-effort report to our own server logs (see
  // app/api/client-error-log/route.ts) so a real pattern here — the same
  // chunk error firing over and over for one route — is actually visible
  // instead of only ever silently auto-fixing itself.
  try {
    fetch("/api/client-error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "chunk-error",
        message: message || "stale chunk/module load failure",
        pathname: window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }

  try {
    window.location.reload();
  } catch {
    /* ignore */
  }
}

export default function ChunkErrorRecovery() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (looksLikeStaleChunkError(event.message)) recoverFromStaleChunkOnce(event.message);
    }
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      if (looksLikeStaleChunkError(message)) recoverFromStaleChunkOnce(message);
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
