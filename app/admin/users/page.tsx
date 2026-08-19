"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  AlertTriangle,
  ShieldOff,
  Crown,
  ShieldCheck,
  ExternalLink,
  UserRound,
  Trash2,
  X,
  Monitor,
  MapPin,
  LogOut,
  ChevronDown,
} from "lucide-react";

interface AdminUserRow {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  isSuspended: boolean;
  email: string | null;
  /** ISO expiry of InPlayer Premium, or null if never granted / expired.
   *  See app/lib/premium.ts — anything absent or past reads as free. */
  premiumUntil: string | null;
}


// Mirrors isPremiumFromRecord in app/lib/premium.ts — an absent, expired or
// unparseable date is simply not Premium.
function isPremiumActive(premiumUntil: string | null): boolean {
  if (!premiumUntil) return false;
  const expiry = new Date(premiumUntil).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
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

// Deleting a real account is permanent and immediate — no undo, no grace
// period (see app/lib/cascadeDelete.ts for exactly what it wipes: every
// video, comment, like, membership, KYC document, the profile, and the
// real Cognito sign-in itself). A plain window.confirm() is what the
// Suspend button uses, but that's reversible; this isn't, so it gets a
// stronger "type the exact handle" gate instead — the same pattern
// GitHub/Vercel use for destructive deletes, appropriate for a
// non-technical admin about to do something they can't take back.
function DeleteUserModal({
  user,
  onCancel,
  onConfirm,
  deleting,
}: {
  user: AdminUserRow;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const expected = user.username || user.userId;
  const canConfirm = confirmText.trim() === expected;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-red-500/25 bg-[#0B1420] light:bg-[#FBF6EA] p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black text-red-300 light:text-red-700">
            <AlertTriangle size={18} /> Permanently delete this account?
          </h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-400 light:text-slate-600">
          This immediately and permanently removes{" "}
          <span className="font-bold text-slate-200 light:text-slate-800">
            {user.name || user.username || "this account"}
          </span>{" "}
          from InPlayer: every video/Short they uploaded (and its comments, likes, watch
          history), their profile, KYC documents, and their real sign-in account (they can
          never log back in). Any active paid memberships involving them are cancelled at
          Razorpay too. There is no undo.
        </p>

        <p className="mt-3 text-xs font-semibold text-slate-300 light:text-slate-700">
          Type <span className="rounded bg-white/10 light:bg-black/10 px-1.5 py-0.5 font-mono text-indigo-300 light:text-indigo-800">{expected}</span>{" "}
          to confirm:
        </p>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-white px-3 py-2 text-sm text-white light:text-slate-900 outline-none focus:border-red-400/50"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 light:text-slate-600 hover:bg-white/5 light:hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm || deleting}
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-xl bg-red-500/20 light:bg-red-100 px-4 py-2 text-xs font-bold text-red-300 light:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdminSessionRow {
  sessionId: string;
  device: string | null;
  location: string | null;
  createdAt: string;
}

// Real per-account device/location visibility for the admin — every row
// here is an actual InPlayer-Sessions entry from a real sign-in (see
// app/lib/sessions.ts), not simulated. "Log out" here uses the same admin-
// aware /api/sessions routes Settings > Privacy uses for a person's own
// account, just targeting someone else's userId.
function UserSessionsPanel({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch(`/api/sessions?userId=${encodeURIComponent(userId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Couldn't load sessions.");
        if (!cancelled) setSessions(data.sessions || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const logOutOne = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      const res = await authedFetch(
        `/api/sessions/${sessionId}?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      if (res.ok) setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const logOutAll = async () => {
    if (!window.confirm("Force-log-out every device this account is currently signed in on?")) {
      return;
    }
    setLoggingOutAll(true);
    try {
      const res = await authedFetch("/api/sessions/logout-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) setSessions([]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoggingOutAll(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 light:border-black/10 bg-black/10 light:bg-black/[0.03] p-3">
      {error ? (
        <p className="text-xs text-red-300">{error}</p>
      ) : loading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 size={16} className="animate-spin text-slate-400" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-slate-500">Not currently signed in on any device.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {sessions.length} active device{sessions.length === 1 ? "" : "s"}
            </p>
            <button
              type="button"
              onClick={logOutAll}
              disabled={loggingOutAll}
              className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-300 light:text-red-700 hover:bg-red-500/25 disabled:opacity-60"
            >
              {loggingOutAll ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
              Log out all
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5"
              >
                <div className="min-w-0 text-xs text-slate-300 light:text-slate-700">
                  <span className="inline-flex items-center gap-1">
                    <Monitor size={11} /> {s.device || "Unknown device"}
                  </span>
                  <span className="mx-1.5 text-slate-600">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} /> {s.location || "Unknown location"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => logOutOne(s.sessionId)}
                  disabled={busyId === s.sessionId}
                  className="flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-300 disabled:opacity-60"
                >
                  {busyId === s.sessionId ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <LogOut size={11} />
                  )}
                  Log out
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Accept ?q=<userId|name|email> so other admin pages can deep-link
  // straight to a specific account — the Moderation queue's "Open in Users"
  // link on each flagged item is what needs this. Read off
  // window.location rather than useSearchParams() on purpose: the hook
  // requires a <Suspense> boundary around the whole page in Next 16 and
  // fails the build without one, and this page is client-only regardless.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) {
      setQuery(initial);
      // Seed the debounced value too, so the first fetch below already
      // carries the search instead of loading the unfiltered list first.
      setDebouncedQuery(initial);
    }
  }, []);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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

  // Grant or revoke InPlayer Premium. Premium is a single `premiumUntil`
  // date on the user row (app/lib/premium.ts); billing isn't wired up yet,
  // so until it is this is the only way an account becomes Premium — the
  // alternative was editing DynamoDB by hand.
  const togglePremium = async (userRow: AdminUserRow) => {
    const label = userRow.username || userRow.name || "this user";
    const active = isPremiumActive(userRow.premiumUntil);

    let months = 12;
    if (active) {
      if (
        !window.confirm(
          `Revoke Premium for ${label}? They'll drop back to the free tier immediately — video quality capped at 1080p.`
        )
      ) {
        return;
      }
    } else {
      const answer = window.prompt(
        `Grant Premium to ${label} for how many months?`,
        "12"
      );
      if (answer === null) return;
      const parsed = Math.floor(Number(answer));
      if (!Number.isFinite(parsed) || parsed < 1) {
        window.alert("Enter a whole number of months, 1 or more.");
        return;
      }
      months = Math.min(parsed, 120);
    }

    setActioningId(userRow.userId);
    try {
      const res = await authedFetch(`/api/admin/users/${userRow.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          active ? { premium: false } : { premiumMonths: months }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update Premium.");

      setUsers((prev) =>
        prev.map((u) =>
          u.userId === userRow.userId
            ? { ...u, premiumUntil: data.premiumUntil ?? null }
            : u
        )
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setActioningId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setDeleteBusy(true);
    try {
      const res = await authedFetch(`/api/admin/users/${deletingUser.userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this account.");

      if (data.warnings?.length) {
        console.error("Account deleted with partial cleanup failures:", data.warnings);
      }

      setUsers((prev) => prev.filter((u) => u.userId !== deletingUser.userId));
      setDeletingUser(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Users</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real accounts from InPlayer&apos;s database. Search by username or user ID, or browse
          everyone.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or user ID…"
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
          <Loader2 size={24} className="animate-spin text-indigo-400" />
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
              className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4"
            >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- avatarUrl may be a compressed base64 data URL (see app/api/profile/avatar/route.ts), which next/image can't optimize without the `unoptimized` prop.
                  <img
                    src={u.avatarUrl}
                    alt={u.username || "User"}
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
                      <span className="shrink-0 rounded-full bg-red-500/15 light:bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300 light:text-red-700">
                        Suspended
                      </span>
                    )}
                    {isPremiumActive(u.premiumUntil) && (
                      <span
                        className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-300"
                        title={`Premium until ${formatDate(u.premiumUntil)}`}
                      >
                        Premium
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
                  onClick={() => togglePremium(u)}
                  disabled={actioningId === u.userId}
                  title={
                    isPremiumActive(u.premiumUntil)
                      ? `Premium until ${formatDate(u.premiumUntil)}`
                      : "Grant InPlayer Premium (4K streaming)"
                  }
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isPremiumActive(u.premiumUntil)
                      ? "bg-orange-500/20 text-orange-200 hover:bg-orange-500/30"
                      : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:bg-orange-500/15 hover:text-orange-300"
                  }`}
                >
                  <Crown size={13} />
                  {isPremiumActive(u.premiumUntil) ? "Premium" : "Make Premium"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSuspend(u)}
                  disabled={actioningId === u.userId}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    u.isSuspended
                      ? "bg-emerald-500/15 light:bg-emerald-100 text-emerald-300 light:text-emerald-700 hover:bg-emerald-500/25 light:hover:bg-emerald-200"
                      : "bg-red-500/15 light:bg-red-100 text-red-300 light:text-red-700 hover:bg-red-500/25 light:hover:bg-red-200"
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
                <button
                  type="button"
                  onClick={() => setDeletingUser(u)}
                  disabled={actioningId === u.userId}
                  className="flex items-center gap-1.5 rounded-xl bg-white/5 light:bg-black/5 px-3 py-2 text-xs font-bold text-slate-400 light:text-slate-600 transition hover:bg-red-500/15 hover:text-red-300 light:hover:bg-red-100 light:hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedUserId(expandedUserId === u.userId ? null : u.userId)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/5 light:bg-black/5 px-3 py-2 text-xs font-bold text-slate-400 light:text-slate-600 transition hover:bg-white/10 light:hover:bg-black/10"
                >
                  <Monitor size={13} />
                  Sessions
                  <ChevronDown
                    size={13}
                    className={`transition-transform ${expandedUserId === u.userId ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>
            {expandedUserId === u.userId && <UserSessionsPanel userId={u.userId} />}
            </div>
          ))}
        </div>
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onCancel={() => setDeletingUser(null)}
          onConfirm={confirmDelete}
          deleting={deleteBusy}
        />
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
