"use client";

import { ReactNode, useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import AdminHeader from "@/app/components/admin/AdminHeader";
import AdminSidebar from "@/app/components/admin/AdminSidebar";
import AdminMobileNav from "@/app/components/admin/AdminMobileNav";
import { AdminModeProvider } from "@/app/components/admin/AdminModeContext";
import { AdminRefreshProvider } from "@/app/components/admin/AdminRefreshContext";
import { AdminIdentityProvider } from "@/app/components/admin/AdminIdentityContext";
import { getStoredSessionId } from "@/app/lib/sessionClient";

// Gate for every /admin/* page (including the pre-existing
// /admin/captions tool, which now sits inside this same shell). This is a
// CLIENT-side check because InPlayer's whole auth model is Cognito tokens
// held in the browser (see app/lib/verifyAuth.ts) — there's no server
// session cookie a server component could read instead. The real
// enforcement still lives server-side: every /api/admin/* route calls
// requireAdmin()/isAdminEmail() itself (app/lib/isAdmin.ts), so even if
// someone bypassed this screen entirely, the underlying data stays
// protected. This layout's job is purely to keep a signed-in-but-not-admin
// visitor from seeing the admin UI at all.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signedIn, authLoading, openSignIn, user, signOut } = useAuthModal();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  // This device's session was ended (logged out elsewhere, or evicted by
  // the 5-device limit) while the browser still holds a valid sign-in.
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    // The not-signed-in case is handled inside this same async function
    // (rather than as an early return directly in the effect body) purely
    // so its setState calls are consistent with the rest of this effect —
    // react-hooks/set-state-in-effect flags setState called synchronously
    // straight in an effect body, but not inside a nested function like
    // this one.
    (async () => {
      if (!signedIn) {
        if (!cancelled) {
          setChecking(false);
          setIsAdmin(false);
          setSessionEnded(false);
        }
        return;
      }

      // Re-checking (e.g. right after signing back in): show the spinner,
      // not the previous result — a stale "Please sign in again" screen
      // here invited a click that signed the person straight back out.
      if (!cancelled) {
        setChecking(true);
        setSessionEnded(false);
      }

      try {
        let session = await fetchAuthSession().catch(() => null);
        let idToken = session?.tokens?.idToken?.toString();
        if (!idToken) {
          session = await fetchAuthSession({ forceRefresh: true }).catch(() => null);
          idToken = session?.tokens?.idToken?.toString();
        }
        if (!idToken) {
          if (!cancelled) {
            setIsAdmin(false);
            setChecking(false);
          }
          return;
        }

        // Send this device's session id like every admin data request does
        // (app/lib/apiFetch.ts). Without it this check passed while every
        // page behind it was rejected, so the panel said "Signed in as ..."
        // yet showed "Unauthorized" everywhere.
        const sessionId = getStoredSessionId();
        const res = await fetch("/api/admin/me", {
          headers: {
            Authorization: `Bearer ${idToken}`,
            ...(sessionId ? { "X-Session-Id": sessionId } : {}),
          },
        }).catch(() => null);

        if (!res) {
          if (!cancelled) {
            setIsAdmin(false);
            setChecking(false);
          }
          return;
        }

        const data = await res.json().catch(() => ({ isAdmin: false }));

        if (!cancelled) {
          setSessionEnded(res.status === 401 && data?.code === "SESSION_REVOKED");
          setIsAdmin(Boolean(data?.isAdmin));
          setIsMainAdmin(Boolean(data?.isMainAdmin));
          setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
          setChecking(false);
        }
      } catch (err) {
        console.error("Admin access check failed:", err);
        if (!cancelled) {
          setIsAdmin(false);
          setIsMainAdmin(false);
          setPermissions([]);
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, authLoading, user?.email, user?.userId]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-black text-white light:text-slate-900">
          Sign in required
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          Sign in with the admin account to open the Admin Panel.
        </p>
        <button
          onClick={() => openSignIn()}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(139,92,246,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <ShieldAlert size={26} className="text-amber-400" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-white light:text-slate-900">
          Please sign in again
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          Your session on this device has ended — you were signed out here
          from another device, or more than 5 devices were signed in. Sign in
          again to open the Admin Panel.
        </p>
        <button
          onClick={async () => {
            await signOut().catch(() => {});
            openSignIn();
          }}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(139,92,246,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign in again
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <ShieldAlert size={26} className="text-red-400" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-white light:text-slate-900">
          Not authorized
        </h2>
        <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
          {user?.email || "This account"} doesn&apos;t have admin access on
          InPlayer.
        </p>
      </div>
    );
  }

  return (
    <AdminIdentityProvider isMainAdmin={isMainAdmin} permissions={permissions}>
      <AdminModeProvider>
        <AdminRefreshProvider>
          <div className="min-h-screen bg-[#06101D] light:bg-transparent text-white light:text-slate-900">
            <AdminHeader email={user?.email || null} />

            <div className="mx-auto max-w-[1700px] px-5 py-8 lg:px-8">
              <AdminMobileNav />

              <div className="lg:flex lg:items-start lg:gap-8">
                <AdminSidebar />
                <main className="min-w-0 flex-1">{children}</main>
              </div>
            </div>
          </div>
        </AdminRefreshProvider>
      </AdminModeProvider>
    </AdminIdentityProvider>
  );
}
