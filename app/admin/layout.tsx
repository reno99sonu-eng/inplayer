"use client";

import { ReactNode, useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import AdminHeader from "@/app/components/admin/AdminHeader";
import AdminSidebar from "@/app/components/admin/AdminSidebar";
import AdminMobileNav from "@/app/components/admin/AdminMobileNav";

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
  const { signedIn, authLoading, openSignIn, user } = useAuthModal();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
        }
        return;
      }

      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) {
          if (!cancelled) {
            setIsAdmin(false);
            setChecking(false);
          }
          return;
        }

        const res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();

        if (!cancelled) {
          setIsAdmin(Boolean(data.isAdmin));
          setChecking(false);
        }
      } catch (err) {
        console.error("Admin access check failed:", err);
        if (!cancelled) {
          setIsAdmin(false);
          setChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, authLoading]);

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
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(139,92,246,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
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
  );
}
