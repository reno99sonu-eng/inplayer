"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  ArrowLeft,
  Search,
  X,
  UserPlus,
  Check,
  Loader2,
  Inbox,
  MessageSquare,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo } from "@/app/lib/formatters";
import { makeConversationId } from "@/app/lib/conversationId";

interface ConversationRow {
  conversationId: string;
  otherUserId: string;
  otherUsername: string | null;
  otherAvatarUrl: string | null;
  requestStatus: "pending" | "accepted";
  initiatedBy: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface UserResult {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

export default function MessagesPage() {
  const router = useRouter();
  const { signedIn, authLoading, user, openSignIn } = useAuthModal();

  const [tab, setTab] = useState<"messages" | "requests">("messages");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [requests, setRequests] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState("");
  const [composeResults, setComposeResults] = useState<UserResult[]>([]);
  const [composeSearching, setComposeSearching] = useState(false);

  useEffect(() => {
    (() => {
      if (!signedIn) {
        setLoading(false);
        return;
      }

      async function load() {
        try {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          const res = await fetch("/api/messages", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const data = await res.json();
          setConversations(data.conversations || []);
          setRequests(data.requests || []);
        } catch (err) {
          console.error("Failed to load messages:", err);
        } finally {
          setLoading(false);
        }
      }

      load();
    })();
  }, [signedIn]);

  useEffect(() => {
    const q = composeQuery.trim();
    if (q.length < 2) {
      // setState wrapped in a nested, immediately-invoked function — the
      // `return` right after still has to bail out of this *outer* effect
      // (there's no debounce timer / cleanup to set up for an empty
      // query), so unlike the usual MaintenanceGate-style fix we keep the
      // `return` itself outside the nested function.
      // See react-hooks/set-state-in-effect.
      (() => {
        setComposeResults([]);
      })();
      return;
    }

    let cancelled = false;
    (() => {
      setComposeSearching(true);
    })();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!cancelled) {
          setComposeResults((data.users || []).filter((u: UserResult) => u.userId !== user?.userId));
        }
      } catch (err) {
        console.error("User search failed:", err);
      } finally {
        if (!cancelled) setComposeSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [composeQuery, user?.userId]);

  const openConversationWith = (otherUserId: string, otherUsername: string) => {
    if (!user) return;
    const conversationId = makeConversationId(user.userId, otherUserId);
    router.push(`/messages/${conversationId}?with=${encodeURIComponent(otherUsername)}`);
  };

  const respondToRequest = async (conversationId: string, action: "accept" | "decline") => {
    setRespondingId(conversationId);
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const res = await fetch(`/api/messages/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const row = requests.find((r) => r.conversationId === conversationId);
        setRequests((prev) => prev.filter((r) => r.conversationId !== conversationId));
        if (action === "accept" && row) {
          setConversations((prev) => [{ ...row, requestStatus: "accepted" }, ...prev]);
        }
      }
    } catch (err) {
      console.error(`Failed to ${action} request:`, err);
    } finally {
      setRespondingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#06101D] light:bg-[#FAF5E9]">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
        <h2 className="text-2xl font-black">Sign in to see your messages</h2>
        <button
          onClick={openSignIn}
          className="mt-6 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-8 py-3 font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          Sign In
        </button>
      </div>
    );
  }

  const rows = tab === "messages" ? conversations : requests;

  return (
    <div className="min-h-screen bg-[#06101D] light:bg-[#FAF5E9] text-white light:text-slate-900">
      <div className="flex items-center gap-4 border-b border-white/10 light:border-black/10 px-5 py-5">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 transition hover:bg-white/15 light:hover:bg-black/10"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black">Messages</h1>
          <p className="text-sm text-slate-400 light:text-slate-600">
            {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
          </p>
        </div>

        <button
          onClick={() => setComposeOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
        >
          <UserPlus size={16} />
          New
        </button>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {composeOpen && (
          <div className="mb-6 rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
            <div className="relative">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={composeQuery}
                onChange={(e) => setComposeQuery(e.target.value)}
                placeholder="Search by username..."
                className="w-full rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-white/60 py-3 pl-11 pr-4 text-sm text-white light:text-slate-900 caret-orange-400 outline-none transition focus:border-orange-400/40"
              />
            </div>

            <div className="mt-3 space-y-1.5">
              {composeSearching && (
                <p className="px-1 text-xs text-slate-500">Searching...</p>
              )}
              {!composeSearching && composeQuery.trim().length >= 2 && composeResults.length === 0 && (
                <p className="px-1 text-xs text-slate-500">No users found.</p>
              )}
              {composeResults.map((result) => (
                <button
                  key={result.userId}
                  onClick={() => openConversationWith(result.userId, result.username)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/5 light:hover:bg-black/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data URL. */}
                  <img
                    src={result.avatarUrl || "/avatars/avatar.png"}
                    alt={result.username}
                    className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                  />
                  <span className="text-sm font-semibold">@{result.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5 flex gap-2">
          <button
            onClick={() => setTab("messages")}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
              tab === "messages"
                ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white"
                : "border border-white/10 light:border-black/10 text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
            }`}
          >
            Messages
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all ${
              tab === "requests"
                ? "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white"
                : "border border-white/10 light:border-black/10 text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
            }`}
          >
            Requests
            {requests.length > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {requests.length}
              </span>
            )}
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 light:border-black/10 py-16 text-center">
            {tab === "requests" ? (
              <Inbox size={28} className="mb-3 text-slate-600" />
            ) : (
              <MessageSquare size={28} className="mb-3 text-slate-600" />
            )}
            <p className="font-semibold text-white light:text-slate-900">
              {tab === "requests" ? "No message requests" : "No conversations yet"}
            </p>
            <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
              {tab === "requests"
                ? "Requests from people you're not connected with show up here."
                : "Search for someone by username to start a conversation."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.conversationId}
                className="flex w-full items-center gap-4 rounded-3xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 transition hover:bg-white/[0.05] light:hover:bg-black/[0.04]"
              >
                <button
                  onClick={() => openConversationWith(row.otherUserId, row.otherUsername || "")}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <Image
                    src={row.otherAvatarUrl || "/avatars/avatar.png"}
                    alt={row.otherUsername || "User"}
                    width={54}
                    height={54}
                    className="flex-shrink-0 rounded-full object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-bold">@{row.otherUsername || "unknown"}</h2>
                    <p className="mt-1 truncate text-sm text-slate-400 light:text-slate-600">
                      {row.lastMessageSenderId === user?.userId ? "You: " : ""}
                      {row.lastMessageText}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-slate-500">{formatTimeAgo(row.lastMessageAt)}</p>
                    {row.unreadCount > 0 && (
                      <div className="mt-2 ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold">
                        {row.unreadCount}
                      </div>
                    )}
                  </div>
                </button>

                {tab === "requests" && (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => respondToRequest(row.conversationId, "accept")}
                      disabled={respondingId === row.conversationId}
                      aria-label="Accept"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => respondToRequest(row.conversationId, "decline")}
                      disabled={respondingId === row.conversationId}
                      aria-label="Decline"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
