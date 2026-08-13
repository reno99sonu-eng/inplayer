"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, ShieldCheck, Search, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useAdminMode } from "@/app/components/admin/AdminModeContext";
import { getSiteDomain, DOMAIN_LABELS } from "@/app/lib/siteDomain";

interface LogEntry {
  errorId: string;
  kind: string;
  message: string;
  stack: string | null;
  digest: string | null;
  pathname: string;
  userAgent: string | null;
  createdAt: string;
}

function kindBadgeClasses(kind: string): string {
  if (kind === "chunk-error") return "bg-amber-500/15 text-amber-300";
  if (kind === "global-error") return "bg-red-500/15 text-red-300";
  return "bg-slate-500/15 text-slate-300";
}

export default function AdminErrorLogsPage() {
  const { mode } = useAdminMode();
  const domainLabel = DOMAIN_LABELS[mode];
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/error-logs");
      if (!res.ok) throw new Error(`Couldn't load error logs (HTTP ${res.status}).`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTableMissing(Boolean(data.tableMissing));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wrapped in an IIFE rather than calling load() directly — same
    // react-hooks/set-state-in-effect workaround used throughout this
    // codebase (see SplashScreen.tsx, MaintenanceGate.tsx).
    (() => {
      load();
    })();
    // Real crashes are worth seeing without a manual refresh — this page
    // polls the same way Admin > Notifications does, not a one-time load.
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  // Crashes are automatic and can happen on any page across all three
  // products — bucket each one by which panel its pathname belongs to
  // (via the same getSiteDomain() MaintenanceGate/AnnouncementBanner use)
  // so InPlayer, Hammart, and Sponsorship each only ever see their own
  // crashes here, instead of one shared unfiltered list.
  const domainLogs = useMemo(() => logs.filter((l) => getSiteDomain(l.pathname) === mode), [logs, mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return domainLogs;
    return domainLogs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.pathname.toLowerCase().includes(q) ||
        l.kind.toLowerCase().includes(q)
    );
  }, [domainLogs, query]);

  const removeOne = async (errorId: string) => {
    setBusyId(errorId);
    try {
      const res = await authedFetch(`/api/admin/error-logs?id=${encodeURIComponent(errorId)}`, { method: "DELETE" });
      if (res.ok) setLogs((prev) => prev.filter((l) => l.errorId !== errorId));
    } finally {
      setBusyId(null);
    }
  };

  // Deletes only THIS panel's entries, one at a time — the API only offers
  // "delete one by id" or "delete literally everything", and a blanket
  // clear-everything button here would wipe InPlayer's and Sponsorship's
  // crash history right along with Hammart's, which is exactly the kind of
  // cross-panel side effect Reno asked to have removed.
  const clearAll = async () => {
    if (domainLogs.length === 0) return;
    if (!window.confirm(`Delete all ${domainLogs.length} ${domainLabel} error log entries? This can't be undone. InPlayer/Hammart/Sponsorship's other logs are untouched.`)) return;
    setClearing(true);
    try {
      const ids = domainLogs.map((l) => l.errorId);
      await Promise.all(
        ids.map((id) => authedFetch(`/api/admin/error-logs?id=${encodeURIComponent(id)}`, { method: "DELETE" }))
      );
      setLogs((prev) => prev.filter((l) => !ids.includes(l.errorId)));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white light:text-slate-900">{domainLabel} Error Logs</h2>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Real crashes caught automatically on {domainLabel} visitors&apos; devices — no report
            needed from them. InPlayer, Hammart, and Sponsorship each show only their own crashes
            here. Refreshes itself every 30 seconds.
          </p>
        </div>
        {domainLogs.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={clearing}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Clear all
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by message, page, or type…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          InPlayer-Error-Logs hasn&apos;t been created in AWS yet — create a DynamoDB table named{" "}
          <code className="rounded bg-black/20 px-1">InPlayer-Error-Logs</code> with partition key{" "}
          <code className="rounded bg-black/20 px-1">errorId</code> (String) and this page will start filling in
          automatically the next time something crashes.
        </div>
      )}
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
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">
            {query ? `Nothing matches "${query}".` : "No crashes logged. Everything's been clean."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((l) => {
            const isOpen = expanded === l.errorId;
            return (
              <div
                key={l.errorId}
                className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${kindBadgeClasses(l.kind)}`}>
                        {l.kind}
                      </span>
                      <span className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                    <p className="mt-1.5 break-words text-sm text-white light:text-slate-900">{l.message}</p>
                    <Link href={l.pathname} target="_blank" className="mt-0.5 block truncate text-[11px] text-indigo-300 hover:underline">
                      {l.pathname}
                    </Link>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === l.errorId}
                    onClick={() => removeOne(l.errorId)}
                    className="flex-shrink-0 rounded-xl p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                    aria-label="Delete this log entry"
                  >
                    {busyId === l.errorId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>

                {(l.stack || l.userAgent || l.digest) && (
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : l.errorId)}
                    className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:underline"
                  >
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isOpen ? "Hide details" : "View details"}
                  </button>
                )}
                {isOpen && (
                  <div className="mt-2 space-y-2 rounded-xl bg-black/20 light:bg-black/[0.04] p-3">
                    {l.digest && (
                      <p className="text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Digest:</span> {l.digest}
                      </p>
                    )}
                    {l.userAgent && (
                      <p className="text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">Device:</span> {l.userAgent}
                      </p>
                    )}
                    {l.stack && (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-400">
                        {l.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
