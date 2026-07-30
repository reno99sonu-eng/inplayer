"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Search,
  Loader2,
  AlertTriangle,
  ShieldOff,
  ShieldCheck,
  ExternalLink,
  UserRound,
} from "lucide-react";

interface AdminUserRow {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  isSuspended: boolean;
  email: string | null;
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  if (!idToken) throw new Error("Session expired — please sign in again.");

  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${idToken}`,
    },
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Debounce the search box the same way ShortCreationTools debounces its
  // music search — avoids firing a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = debouncedQuery
          ? `/api/admin/users?query=${encodeURIComponent(debouncedQuery)}`
          : "/api/admin/users";
        const res = await authedFetch(url);
        if (!res.ok) throw new Error(`Couldn't load users (HTTP ${res.status}).`);
        const data = await res.json();
        if (!cancelled) {
          setUsers(data.users || []);
          setNextCursor(data.nextCursor || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const loadMore = async () => {
    if (!nextCursor || debouncedQuery) return;
    setLoadingMore(true);
    try {
      const res = await authedFetch(`/api/admin/users?cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) throw new Error(`Couldn't load more users (HTTP ${res.status}).`);
      const data = await res.json();
      setUsers((prev) => [...prev, ...(data.users || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleSuspend = async (userRow: AdminUserRow) => {
    const nextState = !userRow.isSuspended;
    const label = userRow.username || userRow.name || "this user";
    const confirmMsg = nextState
      ? `Suspend ${label}? They'll immediately be blocked from uploading, liking, commenting, and messaging anywhere on InPlayer.`
      : `Remove the suspension on ${label}? They'll immediately be able to use InPlayer normally again.`;

    if (!window.confirm(confirmMsg)) return;

    setActioningId(userRow.userId);
    try {
      const res = await authedFetch(`/api/admin/users/${userRow.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update this user.");

      setUsers((prev) =>
        prev.map((u) => (u.userId === userRow.userId ? { ...u, isSuspended: nextState } : u))
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Users</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real accounts from InPlayer&apos;s database. Search by username, or browse everyone.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      ) : users.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          {debouncedQuery ? `No users match "${debouncedQuery}".` : "No users found yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {users.map((u) => (
            <div
              key={u.userId}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                {u.avatarUrl ? (
                  <Image
                    src={u.avatarUrl}
                    alt={u.username || "User"}
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 light:bg-black/10">
                    <UserRound size={20} className="text-slate-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-white light:text-slate-900">
                      {u.name || "Unnamed"}
                    </p>
                    {u.isSuspended && (
                      <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400 light:text-slate-600">
                    {u.username ? `@${u.username}` : "No username yet"} · Joined{" "}
                    {formatDate(u.createdAt)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {u.email || "Email unavailable"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {u.username && (
                  <Link
                    href={`/u/${u.username}`}
                    target="_blank"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 light:border-black/10 px-3 py-2 text-xs font-semibold text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
                  >
                    <ExternalLink size={13} />
                    Profile
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => toggleSuspend(u)}
                  disabled={actioningId === u.userId}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    u.isSuspended
                      ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  }`}
                >
                  {actioningId === u.userId ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : u.isSuspended ? (
                    <ShieldCheck size={13} />
                  ) : (
                    <ShieldOff size={13} />
                  )}
                  {u.isSuspended ? "Unsuspend" : "Suspend"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!debouncedQuery && nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-5 w-full rounded-2xl border border-white/10 light:border-black/10 py-3 text-sm font-bold text-slate-300 light:text-slate-700 transition hover:bg-white/5 light:hover:bg-black/5 disabled:opacity-60"
        >
          {loadingMore ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </span>
          ) : (
            "Load more"
          )}
        </button>
      )}
    </div>
  );
}
