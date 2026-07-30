"use client";

import { useEffect, useState } from "react";
import { Monitor, MapPin, LogOut, Loader2, AlertTriangle } from "lucide-react";
import { authedFetch } from "@/app/lib/apiFetch";
import { getStoredSessionId, clearStoredSessionId } from "@/app/lib/sessionClient";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

interface SessionRow {
  sessionId: string;
  device: string | null;
  location: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// Real "where you're logged in" — every row here is an actual InPlayer-
// Sessions entry created the moment a device signed in (see
// app/lib/sessions.ts), not a placeholder. Logging out an individual
// device deletes its row; that device is treated as signed out the very
// next time it calls an authedFetch()'d API route (at most ~45s later,
// via the presence heartbeat in AuthProvider.tsx — see that file for why
// this can't be instant the way "log out everywhere" is).
export default function SessionsCard() {
  const { signOut } = useAuthModal();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const currentSessionId = getStoredSessionId();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/sessions");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't load your sessions.");
      setSessions(data.sessions || []);
      setTableMissing(Boolean(data.tableMissing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const logOutOne = async (sessionId: string) => {
    setBusyId(sessionId);
    try {
      const res = await authedFetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (sessionId === currentSessionId) {
          clearStoredSessionId();
          await signOut();
        }
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const logOutAll = async () => {
    if (
      !window.confirm(
        "Log out of every device, including this one? You'll need to sign in again everywhere."
      )
    ) {
      return;
    }
    setLoggingOutAll(true);
    try {
      await authedFetch("/api/sessions/logout-all", { method: "POST" });
      clearStoredSessionId();
      await signOut();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoggingOutAll(false);
    }
  };

  if (tableMissing) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-slate-400 light:text-slate-600" />
          <p className="font-bold text-white light:text-slate-900">Where you&apos;re logged in</p>
        </div>
        {sessions.length > 1 && (
          <button
            type="button"
            onClick={logOutAll}
            disabled={loggingOutAll}
            className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
          >
            {loggingOutAll ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            Log out of all devices
          </button>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400 light:text-slate-600">
        Up to 5 devices can be signed in to your account at once. A new sign-in past that signs
        the oldest device out automatically.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300 light:text-red-700">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {sessions.map((s) => (
            <div
              key={s.sessionId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 light:border-black/10 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white light:text-slate-900">
                    {s.device || "Unknown device"}
                  </p>
                  {s.sessionId === currentSessionId && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                      This device
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 light:text-slate-600">
                  <MapPin size={11} /> {s.location || "Unknown location"} · Signed in{" "}
                  {new Date(s.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => logOutOne(s.sessionId)}
                disabled={busyId === s.sessionId}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-white/10 light:border-black/10 px-3 py-2 text-xs font-semibold text-slate-300 light:text-slate-700 transition hover:bg-white/5 light:hover:bg-black/5 disabled:opacity-60"
              >
                {busyId === s.sessionId ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LogOut size={13} />
                )}
                Log out
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
