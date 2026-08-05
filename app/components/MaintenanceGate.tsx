"use client";

import { ReactNode, useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Wrench } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";
import { usePlatformSettings } from "@/app/hooks/usePlatformSettings";

// Real maintenance mode — flip it on from Admin Panel -> Platform Settings
// and every signed-out visitor and non-admin signed-in user sees the
// splash below instead of the app, using the exact same public settings
// row every other platform toggle reads (app/lib/platformSettings.ts).
// The admin account itself always gets through (checked via the same
// /api/admin/me endpoint AdminLayout uses), so turning maintenance mode
// back off is never something you can accidentally lock yourself out of.
//
// Honest limitation: this is a client-side UI gate, not a server-side
// security boundary — it blocks the normal site for regular visitors (the
// actual point of maintenance mode), but someone calling an API route
// directly wouldn't be stopped by this component. That's an acceptable
// tradeoff for InPlayer's current Cognito-in-the-browser auth model (see
// AdminLayout.tsx's own comment on the same tradeoff), not an oversight.
export default function MaintenanceGate({
  children,
  initialMaintenanceMode,
  initialMaintenanceMessage,
}: {
  children: ReactNode;
  // Server-fetched in app/layout.tsx (via getPlatformSettings(), the same
  // source usePlatformSettings() below reads client-side) — used as the
  // known-correct answer for the window between first paint and this
  // component's own client fetch resolving. Without this, every fresh page
  // load rendered the real site (navbar, homepage, bottom nav) for however
  // long that client fetch took, THEN swapped to the maintenance splash —
  // a flash that's barely visible on a fast desktop connection but stretches
  // out (and reads as "maintenance mode isn't working right") on a slower
  // mobile connection. This makes the very first render already correct on
  // every device, regardless of network speed.
  initialMaintenanceMode: boolean;
  initialMaintenanceMessage: string;
}) {
  const { signedIn, authLoading, user } = useAuthModal();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Once the client's own fetch resolves, its (always-fresh) value takes
  // over; until then, fall back to the server-known value instead of an
  // "unknown, so just show the real site" default.
  const maintenanceOn = settingsLoading
    ? initialMaintenanceMode
    : Boolean(settings?.maintenanceMode);
  const maintenanceMessage = settingsLoading
    ? initialMaintenanceMessage
    : settings?.maintenanceMessage || initialMaintenanceMessage;

  useEffect(() => {
    if (!maintenanceOn || authLoading) return;

    let cancelled = false;

    // The not-signed-in case is handled inside this same async function
    // (rather than as an early return directly in the effect body) so its
    // setState calls are consistent with the rest of this effect — see
    // AdminLayout.tsx's identical comment for why: react-hooks/set-state-in-effect
    // flags setState called synchronously straight in an effect body, but
    // not inside a nested function like this one.
    (async () => {
      if (!signedIn) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      setCheckingAdmin(true);
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (!cancelled) setIsAdmin(Boolean(data.isAdmin));
      } catch (err) {
        console.error("Maintenance gate admin check failed:", err);
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setCheckingAdmin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [maintenanceOn, authLoading, signedIn, user?.userId]);

  // Maintenance fully off — render normally, no gate at all.
  if (!maintenanceOn) {
    return <>{children}</>;
  }

  // Maintenance is ON. Only show the real site once we've positively
  // confirmed this visitor is the signed-in admin — NOT while that check
  // is still in flight (authLoading / checkingAdmin). Showing the real
  // site any earlier, "just in case they turn out to be the admin," is
  // exactly the flash-of-real-content bug this was rewritten to fix: that
  // in-flight window used to default to showing children, so every
  // ordinary visitor saw the real navbar/homepage/bottom nav for however
  // long auth took to resolve before the block ever appeared — barely
  // noticeable on a fast desktop connection, but stretched out (and read
  // as "maintenance mode isn't working") on a slower mobile one. A real
  // admin now sees one brief extra beat of the maintenance screen before
  // it swaps to the real site the instant they're confirmed — a much
  // smaller cost than leaking the real site to everyone else meanwhile.
  if (signedIn && isAdmin && !authLoading && !checkingAdmin) {
    return (
      <>
        <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-center text-xs font-semibold text-amber-300">
          <Wrench size={13} /> Maintenance mode is ON for everyone else — only you can see the
          site right now.
        </div>
        {children}
      </>
    );
  }

  return (
    // min-h-dvh, not min-h-screen (100vh) — 100vh is measured against the
    // largest possible mobile viewport (address bar hidden), so on the
    // very first paint, before the browser settles, the page can render
    // taller than what's actually visible, leaving this centered content
    // looking shifted or clipped depending on the phone/browser chrome —
    // the same class of mobile-only sizing bug already called out and
    // fixed with dvh for the fake-fullscreen video player in this file's
    // globals.css. dvh tracks the real, current visible height instead.
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#06101D] px-6 text-center light:bg-[#F5EEDC]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
        <Wrench size={28} className="text-orange-300" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-white light:text-slate-900">
        Be right back
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
        {maintenanceMessage ||
          "InPlayer is down for scheduled maintenance. We'll be back shortly."}
      </p>
    </div>
  );
}
