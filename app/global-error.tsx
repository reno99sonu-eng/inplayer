"use client";

import { useEffect } from "react";
import {
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_COOLDOWN_MS,
} from "./components/ChunkErrorRecovery";

// Next.js only reaches for this file when something throws while rendering
// the ROOT layout itself (AuthProvider, SiteChrome, SplashScreen, etc.) —
// everywhere else, a normal app/error.tsx would catch it instead. Before
// this file existed, an error up at that level had no boundary at all, so
// the tab just went blank/frozen with nothing to click — indistinguishable
// from "stuck," which is exactly what was reported. This guarantees there
// is always SOME way out: first an automatic reload (this shares its
// cooldown key with app/components/ChunkErrorRecovery.tsx so the two never
// double-fire), and if the same tab hits an error again right after that
// reload — a real, repeating bug rather than a one-off stale-deploy
// hiccup — a visible "Reload" button instead of silently retrying forever.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);

    // Best-effort report to our own server logs (see
    // app/api/client-error-log/route.ts) — this is the ONLY way a crash
    // that only ever happened in one visitor's browser becomes something
    // that shows up where it can actually be diagnosed, since nobody
    // non-technical opens devtools to relay a stack trace by hand.
    try {
      fetch("/api/client-error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "global-error",
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          pathname: window.location.pathname,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }

    try {
      const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
      if (Date.now() - lastReload >= CHUNK_RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // No storage access — fall through to the manual button below rather
      // than risk an un-throttled reload loop.
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#020203",
          color: "#fff",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Something went wrong.</p>
        <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 380, margin: 0 }}>
          We&apos;re trying to recover automatically. If this page doesn&apos;t come back on its
          own, tap reload.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "linear-gradient(90deg,#FF7A18,#FFD54A)",
            color: "#000",
            fontWeight: 700,
            padding: "10px 28px",
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
