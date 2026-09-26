"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

// Real account deletion — see app/api/account/delete/route.ts and
// app/lib/cascadeDelete.ts for exactly what gets removed server-side
// (videos, memberships — cancelled at Razorpay, not just deleted — likes,
// watch history, watchlist, playlists, notifications, everything). That
// route's own last step deletes the actual Cognito sign-in account
// server-side with admin credentials, so — unlike this component's older
// version — nothing here calls deleteUser() from aws-amplify/auth itself:
// by the time this fetch resolves, Cognito no longer has this account at
// all, and calling deleteUser() against a session whose underlying user
// was already removed server-side would just throw. signOut() below only
// clears this browser's now-stale local tokens.
export default function DeleteAccountCard() {
  const router = useRouter();
  const { signOut } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    setError(null);

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();

      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success !== true) {
        throw new Error(data.error || "Couldn't delete your account. Please try again.");
      }

      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        console.warn("Account deletion completed with warnings:", data.warnings);
      }

      // The account (including its Cognito sign-in) is already gone
      // server-side at this point — this just clears this browser's now-
      // stale local session tokens, it doesn't delete anything itself.
      await signOut().catch(() => {});
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-400" />
        <p className="font-bold text-white light:text-slate-900">Delete Account</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">
        Permanently deletes your InPlayer account, your profile, every video/Short
        you&apos;ve uploaded, your likes, watch history, watchlist, and playlists — and
        cancels any active paid membership so you won&apos;t keep being charged. This
        can&apos;t be undone. Comments and messages you&apos;ve sent stay as-is (removing
        them would also erase other people&apos;s conversations and comment threads).
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/25"
      >
        <Trash2 size={15} /> Delete my account
      </button>

      {open && (
        <div
          onClick={() => !deleting && setOpen(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-3xl border border-red-500/25 bg-[#0A1424] light:bg-white p-5 shadow-[0_25px_90px_rgba(0,0,0,.55)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                <AlertTriangle size={22} />
              </div>
              <button
                onClick={() => !deleting && setOpen(false)}
                className="text-slate-400 hover:text-white light:hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="mt-4 text-xl font-black text-white light:text-slate-900">
              This is permanent
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">
              Your account, profile, and every video/Short you&apos;ve uploaded will be deleted
              immediately and can&apos;t be recovered. Type <strong>DELETE</strong> to confirm.
            </p>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              disabled={deleting}
              className="mt-4 w-full rounded-xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] px-4 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-red-400/50 disabled:opacity-60"
            />

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleDelete}
              disabled={!canConfirm || deleting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Deleting your account…
                </>
              ) : (
                "Permanently delete my account"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
