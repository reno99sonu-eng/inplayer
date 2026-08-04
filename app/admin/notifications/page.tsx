"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useState } from "react";
import { Loader2, Megaphone, Send, CheckCircle2, AlertTriangle, Users, User } from "lucide-react";

const MAX_MESSAGE_LENGTH = 500;


export default function AdminNotificationsPage() {
  const [target, setTarget] = useState<"all" | "user">("all");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const canSend =
    message.trim().length > 0 &&
    message.trim().length <= MAX_MESSAGE_LENGTH &&
    (target === "all" || username.trim().length > 0);

  const send = async () => {
    if (!canSend || sending) return;

    const confirmMsg =
      target === "all"
        ? "Send this notification to every real user on InPlayer? This can't be recalled once sent."
        : `Send this notification to @${username.trim()}?`;
    if (!window.confirm(confirmMsg)) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await authedFetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          username: target === "user" ? username.trim() : undefined,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't send that (HTTP ${res.status}).`);

      setResult(
        target === "all"
          ? `Sent to ${data.sentCount} user${data.sentCount === 1 ? "" : "s"}.`
          : `Sent to @${username.trim()}.`
      );
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Notifications</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Send a real notification straight to a user&apos;s notification bell — either
          everyone on InPlayer, or one specific account by username.
        </p>
      </div>

      <div className="mt-5 max-w-xl rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTarget("all")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              target === "all"
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            <Users size={12} /> All users
          </button>
          <button
            type="button"
            onClick={() => setTarget("user")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              target === "user"
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            <User size={12} /> Specific user
          </button>
        </div>

        {target === "user" && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold text-slate-400 light:text-slate-600">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahulcreates"
              className="w-full rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
            />
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-400 light:text-slate-600">
            <span>Message</span>
            <span className={message.length > MAX_MESSAGE_LENGTH ? "text-red-400" : ""}>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="e.g. InPlayer is rolling out paid memberships this week — check your Creator dashboard for details."
            className="w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2.5 text-sm text-white light:text-slate-900 outline-none focus:border-indigo-400/50"
          />
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {result && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 light:text-emerald-700">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
            <span>{result}</span>
          </div>
        )}

        <button
          type="button"
          onClick={send}
          disabled={!canSend || sending}
          className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(139,92,246,.25)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {sending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
          Send notification
        </button>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Megaphone size={12} /> Every send is logged in Audit Logs, and shows up as a real
        notification (with a megaphone icon) in each recipient&apos;s bell.
      </p>
    </div>
  );
}
