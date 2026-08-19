"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, AlertTriangle, Bug, Search, Check, Clock } from "lucide-react";
import { useAdminMode } from "@/app/components/admin/AdminModeContext";
import { getSiteDomain, DOMAIN_LABELS } from "@/app/lib/siteDomain";

type Tab = "open" | "in_progress" | "resolved";

interface Report {
  reportId: string;
  reporterId: string;
  reporterUsername: string | null;
  reporterEmail: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  screenshotDataUrl: string | null;
  status: Tab;
  createdAt: string;
}

export default function AdminBugReportsPage() {
  const { mode } = useAdminMode();
  const domainLabel = DOMAIN_LABELS[mode];
  const [tab, setTab] = useState<Tab>("open");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // User-submitted reports can come from any page across all three
  // products — bucket by which panel the reported page belongs to (same
  // getSiteDomain() helper Error Logs uses on its own pathname field) so
  // each panel only ever sees its own reports.
  const domainReports = useMemo(() => reports.filter((r) => getSiteDomain(r.pageUrl) === mode), [reports, mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return domainReports;
    return domainReports.filter(
      (r) => r.description.toLowerCase().includes(q) || (r.reporterUsername || "").toLowerCase().includes(q) || r.pageUrl.toLowerCase().includes(q)
    );
  }, [domainReports, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch(`/api/admin/bug-reports?status=${tab}`);
        if (!res.ok) throw new Error(`Couldn't load reports (HTTP ${res.status}).`);
        const data = await res.json();
        if (cancelled) return;
        setReports(data.reports || []);
        setTableMissing(Boolean(data.tableMissing));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const setStatus = async (reportId: string, status: Tab) => {
    setBusyId(reportId);
    try {
      const res = await authedFetch("/api/admin/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status }),
      });

      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.reportId !== reportId));
        return;
      }

      // Previously this was a bare `if (res.ok)` with no else and no catch —
      // so a 401 or a 500 left the row exactly where it was and said nothing,
      // which is indistinguishable from the button not being wired up at all.
      // Every comparable handler on the sibling admin pages surfaces the
      // error (see app/admin/hammart-products and app/admin/creators).
      const data = await res.json().catch(() => ({}));
      window.alert(data?.error || `Couldn't update this report (HTTP ${res.status}).`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-black text-white light:text-slate-900">{domainLabel} Bug Reports</h2>
      <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
        Real reports submitted from Settings &gt; Legal &amp; Support &gt; Report a Problem, filtered
        to reports made from a {domainLabel} page. InPlayer, Hammart, and Sponsorship each show
        only their own reports here.
      </p>

      <div className="mt-4 flex items-center gap-2">
        {([{ key: "open", label: "Open" }, { key: "in_progress", label: "In Progress" }, { key: "resolved", label: "Resolved" }] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${tab === t.key ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by description, reporter, or page…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {tableMissing && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          InPlayer-Bug-Reports hasn&apos;t been created in AWS yet.
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
          <Bug size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">{query ? `Nothing matches "${query}".` : "Nothing here."}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((r) => (
            <div key={r.reportId} className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-white light:text-slate-900">{r.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.reporterUsername ? `@${r.reporterUsername}` : r.reporterEmail || r.reporterId} · {new Date(r.createdAt).toLocaleString("en-IN")}
                  </p>
                  <Link href={r.pageUrl} target="_blank" className="mt-0.5 block truncate text-[11px] text-indigo-300 hover:underline">
                    {r.pageUrl}
                  </Link>
                </div>
              </div>

              {r.screenshotDataUrl && (
                <button type="button" onClick={() => setExpanded(expanded === r.reportId ? null : r.reportId)} className="mt-2 text-[11px] font-semibold text-orange-300 hover:underline">
                  {expanded === r.reportId ? "Hide screenshot" : "View screenshot"}
                </button>
              )}
              {expanded === r.reportId && r.screenshotDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.screenshotDataUrl} alt="Screenshot" className="mt-2 max-h-64 rounded-xl border border-white/10" />
              )}

              <div className="mt-3 flex gap-2">
                {tab !== "in_progress" && (
                  <button
                    type="button"
                    disabled={busyId === r.reportId}
                    onClick={() => setStatus(r.reportId, "in_progress")}
                    className="flex items-center gap-1 rounded-xl bg-amber-500/15 light:bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-300 light:text-amber-800 hover:bg-amber-500/25 light:hover:bg-amber-200 disabled:opacity-50"
                  >
                    <Clock size={12} /> In progress
                  </button>
                )}
                {tab !== "resolved" && (
                  <button
                    type="button"
                    disabled={busyId === r.reportId}
                    onClick={() => setStatus(r.reportId, "resolved")}
                    className="flex items-center gap-1 rounded-xl bg-emerald-500/15 light:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-300 light:text-emerald-700 hover:bg-emerald-500/25 light:hover:bg-emerald-200 disabled:opacity-50"
                  >
                    <Check size={12} /> Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
