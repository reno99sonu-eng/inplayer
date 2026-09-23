"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { authedFetch } from "@/app/lib/apiFetch";

// Deliberately NOT under /admin/* — see app/api/admin/team/invite's
// acceptUrl comment. Requires sign-in (like any authenticated action on
// the site) but not admin access, since accepting THIS is what grants
// admin access in the first place.
function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signedIn, authLoading, openSignIn, user } = useAuthModal();
  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const invitationId = searchParams.get("id") || "";
  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (authLoading || !signedIn || !invitationId || !token || status !== "idle") return;

    (async () => {
      setStatus("accepting");
      try {
        const res = await authedFetch("/api/admin/team/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitationId, token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Couldn't accept this invitation.");
          return;
        }
        setStatus("success");
        setMessage("You're now an InPlayer team member.");
        setTimeout(() => router.push("/admin"), 2000);
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    })();
  }, [authLoading, signedIn, invitationId, token, status, router]);

  if (!invitationId || !token) {
    return (
      <Centered>
        <ShieldAlert size={28} className="text-red-400" />
        <p className="mt-3 text-sm font-semibold text-slate-300 light:text-slate-700">
          This invitation link is missing required information.
        </p>
      </Centered>
    );
  }

  if (authLoading) {
    return (
      <Centered>
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </Centered>
    );
  }

  if (!signedIn) {
    return (
      <Centered>
        <ShieldCheck size={28} className="text-indigo-400" />
        <p className="mt-3 text-sm font-semibold text-slate-300 light:text-slate-700">
          Sign in with the email address this invitation was sent to, to accept it.
        </p>
        <button
          onClick={openSignIn}
          className="mt-5 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(139,92,246,.3)]"
        >
          Sign In
        </button>
      </Centered>
    );
  }

  if (status === "accepting" || status === "idle") {
    return (
      <Centered>
        <Loader2 size={28} className="animate-spin text-indigo-400" />
        <p className="mt-3 text-sm text-slate-400">Accepting invitation as {user?.email}…</p>
      </Centered>
    );
  }

  if (status === "success") {
    return (
      <Centered>
        <ShieldCheck size={28} className="text-emerald-400" />
        <p className="mt-3 text-sm font-semibold text-slate-300 light:text-slate-700">{message}</p>
        <p className="mt-1 text-xs text-slate-500">Redirecting to the Admin Panel…</p>
      </Centered>
    );
  }

  return (
    <Centered>
      <ShieldAlert size={28} className="text-red-400" />
      <p className="mt-3 text-sm font-semibold text-slate-300 light:text-slate-700">{message}</p>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <Centered>
          <Loader2 size={28} className="animate-spin text-indigo-400" />
        </Centered>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
