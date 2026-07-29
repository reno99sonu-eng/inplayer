"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { MoreVertical, X, Loader2 } from "lucide-react";

type DeleteMode = "delete_for_me" | "delete_for_everyone";

// WhatsApp-style delete menu for a single message — real backend at
// app/api/messages/[conversationId]/messages' PATCH handler. See that
// route's comment for why "delete for everyone" keeps the row in the
// database (masked, not erased) rather than hard-deleting it.
export default function MessageActionsMenu({
  conversationId,
  messageId,
  mine,
  onDeleted,
}: {
  conversationId: string;
  messageId: string;
  mine: boolean;
  onDeleted: (mode: DeleteMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DeleteMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (mode: DeleteMode) => {
    setBusy(mode);
    setError(null);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch(`/api/messages/${conversationId}/messages`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(idToken && { Authorization: `Bearer ${idToken}` }),
        },
        body: JSON.stringify({ messageId, action: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete that message.");
      onDeleted(mode);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Message options"
        className="mb-1 flex-shrink-0 text-slate-500 transition hover:text-white light:hover:text-slate-900"
      >
        <MoreVertical size={14} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[9990] flex items-end justify-center bg-black/50 p-4 pb-24 backdrop-blur-[2px] sm:items-center sm:pb-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[320px] rounded-2xl border border-white/10 light:border-black/10 bg-[#0A1424] light:bg-[#FBF6EA] p-3 shadow-[0_25px_70px_-20px_rgba(0,0,0,.6)]"
            >
              <div className="mb-1 flex items-center justify-between px-1 pb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 light:text-slate-600">
                  Delete message
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-slate-400 transition hover:text-white light:hover:text-slate-900"
                >
                  <X size={15} />
                </button>
              </div>

              {error && (
                <p className="mb-2 px-1 text-xs text-red-400">{error}</p>
              )}

              <button
                onClick={() => remove("delete_for_me")}
                disabled={busy !== null}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5 disabled:opacity-50"
              >
                {busy === "delete_for_me" && <Loader2 size={14} className="animate-spin" />}
                Delete for me
              </button>

              {mine && (
                <button
                  onClick={() => remove("delete_for_everyone")}
                  disabled={busy !== null}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  {busy === "delete_for_everyone" && <Loader2 size={14} className="animate-spin" />}
                  Delete for everyone
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
