"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Ban,
  BellOff,
  Bell,
  Timer,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import { otherParticipant } from "@/app/lib/conversationId";

interface ConversationDetail {
  conversationId: string;
  otherUserId: string;
  otherUsername: string | null;
  otherAvatarUrl: string | null;
  requestStatus: "pending" | "accepted";
  initiatedBy: string;
  blocked?: boolean;
  blockedByOther?: boolean;
  muted?: boolean;
  disappearingEnabled?: boolean;
  disappearingSeconds?: number | null;
}

interface MessageItem {
  conversationId: string;
  messageId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

const DISAPPEARING_OPTIONS = [
  { seconds: 3600, label: "1 hour" },
  { seconds: 86400, label: "1 day" },
  { seconds: 604800, label: "1 week" },
];

export default function ConversationThreadPage() {
  const params = useParams<{ conversationId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { signedIn, authLoading, user, openSignIn } = useAuthModal();

  const withHint = searchParams.get("with");
  const targetUserId = user ? otherParticipant(params.conversationId, user.userId) : null;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function authHeaders() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    return { Authorization: `Bearer ${idToken}` };
  }

  async function refetchConversation() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/messages/${params.conversationId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setConversationLoaded(true);
    }
  }

  async function fetchMessages() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/messages/${params.conversationId}/messages`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  useEffect(() => {
    if (!signedIn) {
      setConversationLoaded(true);
      return;
    }
    refetchConversation();
    fetchMessages();

    // Simple polling while the thread is open — no WebSocket
    // infrastructure here, but this keeps the thread genuinely live
    // (real fetches, real new messages) rather than static.
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId, signedIn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !targetUserId || !user) return;

    setSending(true);
    setSendError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { conversationId: params.conversationId, messageId: optimisticId, senderId: user.userId, text: trimmed, createdAt: new Date().toISOString() },
    ]);
    setText("");

    try {
      const headers = await authHeaders();
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ otherUserId: targetUserId, text: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setSendError(data.error || "Couldn't send that message.");
        setText(trimmed);
        return;
      }

      await Promise.all([refetchConversation(), fetchMessages()]);
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
      setSendError("Something went wrong. Please try again.");
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action: string, extra?: Record<string, unknown>) => {
    setActionBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/messages/${params.conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        if (action === "decline") {
          router.push("/messages");
          return;
        }
        await refetchConversation();
      }
    } catch (err) {
      console.error(`Failed to ${action}:`, err);
    } finally {
      setActionBusy(false);
    }
  };

  if (authLoading || !conversationLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06101D] light:bg-[#FAF5E9]">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
        <h2 className="text-2xl font-black">Sign in to view this conversation</h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (!targetUserId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
        <p className="font-semibold">That conversation link isn&apos;t valid.</p>
        <Link href="/messages" className="mt-4 text-sm font-semibold text-orange-400">
          Back to Messages
        </Link>
      </div>
    );
  }

  const displayUsername = conversation?.otherUsername || withHint || "…";
  const displayAvatar = conversation?.otherAvatarUrl || "/avatars/avatar.png";
  const isPendingIncoming =
    conversation?.requestStatus === "pending" && conversation?.initiatedBy !== user?.userId;
  const isBlocked = !!(conversation?.blocked || conversation?.blockedByOther);

  return (
    <div className="flex min-h-screen flex-col bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
      <div className="flex items-center gap-3 border-b border-white/10 light:border-black/10 px-4 py-3">
        <button
          onClick={() => router.push("/messages")}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 transition hover:bg-white/15 light:hover:bg-black/10"
        >
          <ArrowLeft size={20} />
        </button>

        <Link
          href={`/u/${encodeURIComponent(displayUsername)}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data URL. */}
          <img src={displayAvatar} alt={displayUsername} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
          <span className="truncate font-bold">@{displayUsername}</span>
        </Link>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 transition hover:bg-white/15 light:hover:bg-black/10"
          >
            <MoreVertical size={18} />
          </button>

          {settingsOpen && (
            <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-[#0B1524] light:bg-white shadow-[0_20px_50px_rgba(0,0,0,.4)]">
              <button
                onClick={() => handleAction(conversation?.muted ? "unmute" : "mute")}
                disabled={actionBusy}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5 disabled:opacity-50"
              >
                {conversation?.muted ? <Bell size={15} /> : <BellOff size={15} />}
                {conversation?.muted ? "Unmute notifications" : "Mute notifications"}
              </button>

              <div className="border-t border-white/10 light:border-black/10 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-200 light:text-slate-800">
                  <Timer size={15} /> Disappearing messages
                </p>
                {conversation?.disappearingEnabled ? (
                  <button
                    onClick={() => handleAction("toggle_disappearing")}
                    disabled={actionBusy}
                    className="text-xs font-semibold text-orange-400 disabled:opacity-50"
                  >
                    On ({DISAPPEARING_OPTIONS.find((o) => o.seconds === conversation.disappearingSeconds)?.label || "1 day"}) — turn off
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {DISAPPEARING_OPTIONS.map((opt) => (
                      <button
                        key={opt.seconds}
                        onClick={() => handleAction("toggle_disappearing", { seconds: opt.seconds })}
                        disabled={actionBusy}
                        className="rounded-full border border-white/10 light:border-black/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 light:text-slate-700 transition hover:border-orange-400/40 disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleAction(conversation?.blocked ? "unblock" : "block")}
                disabled={actionBusy}
                className="flex w-full items-center gap-2.5 border-t border-white/10 light:border-black/10 px-4 py-3 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Ban size={15} />
                {conversation?.blocked ? "Unblock" : "Block"} @{displayUsername}
              </button>
            </div>
          )}
        </div>
      </div>

      {isPendingIncoming && (
        <div className="flex items-center justify-between gap-3 border-b border-orange-400/20 bg-orange-500/[0.06] px-5 py-3">
          <p className="text-xs text-slate-300 light:text-slate-700">
            @{displayUsername} wants to message you. Accept to start chatting freely.
          </p>
          <div className="flex flex-shrink-0 gap-1.5">
            <button
              onClick={() => handleAction("accept")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Check size={13} /> Accept
            </button>
            <button
              onClick={() => handleAction("decline")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              <X size={13} /> Decline
            </button>
          </div>
        </div>
      )}

<div className="mx-auto w-full max-w-3xl flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-slate-400 light:text-slate-800">
  This is the start of your conversation with @{displayUsername}.
</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.userId;
            return (
              <div key={m.messageId} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[72%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white"
                      : "border border-white/10 light:border-black/10 bg-white/[0.04] light:bg-slate-100 text-slate-100 light:text-slate-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-0.5 text-[10px] ${mine ? "text-white/70" : "light:text-slate-600 text-slate-500"}`}>
                    {formatTimeAgo(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-white/10 light:border-black/10 px-4 py-3">
        {isBlocked ? (
          <p className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] px-4 py-3 text-center text-xs text-slate-400 light:text-slate-600">
            {conversation?.blocked
              ? "You've blocked this user — unblock them to send a message."
              : "You can't message this user."}
          </p>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message..."
              className="min-w-0 flex-1 rounded-full border border-white/10 light:border-slate-300 bg-white/[0.03] light:bg-white px-4 py-2.5 text-sm text-white light:text-slate-900 placeholder:text-slate-500 caret-orange-500 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
        )}
        {sendError && <p className="mt-2 text-center text-xs text-red-400">{sendError}</p>}
      </div>
    </div>
  );
}
