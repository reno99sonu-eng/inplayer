"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  Flag,
  Bot,
  Check,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Search,
} from "lucide-react";

type Tab = "reports" | "autoflagged";
type ContentType = "video" | "comment" | "message";

interface ReportItem {
  reportId: string;
  targetType: ContentType;
  videoId?: string;
  commentId?: string;
  conversationId?: string;
  messageId?: string;
  reason: string;
  details?: string;
  reporterId: string;
  createdAt: string;
  snippet: string | null;
}

interface AutoFlagItem {
  id: string;
  contentType: ContentType;
  videoId?: string;
  commentId?: string;
  conversationId?: string;
  messageId?: string;
  categories: string[];
  snippet: string;
  createdAt: string;
}


function contentAdminPath(
  contentType: ContentType,
  item: { videoId?: string; commentId?: string; conversationId?: string; messageId?: string }
): string | null {
  if (contentType === "comment" && item.videoId && item.commentId) {
    return `/api/admin/comments/${item.videoId}/${encodeURIComponent(item.commentId)}`;
  }
  if (contentType === "message" && item.conversationId && item.messageId) {
    return `/api/admin/messages/${item.conversationId}/${encodeURIComponent(item.messageId)}`;
  }
  if (contentType === "video" && item.videoId) {
    return `/api/admin/videos/${item.videoId}`;
  }
  return null;
}

function reasonLabel(reason: string): string {
  return reason.replace(/_/g, " ");
}

export default function AdminModerationPage() {
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [autoFlagged, setAutoFlagged] = useState<AutoFlagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.reportId.toLowerCase().includes(q) ||
        (r.videoId || "").toLowerCase().includes(q) ||
        (r.commentId || "").toLowerCase().includes(q) ||
        (r.messageId || "").toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.snippet || "").toLowerCase().includes(q) ||
        r.reporterId.toLowerCase().includes(q)
    );
  }, [reports, query]);

  const filteredAutoFlagged = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return autoFlagged;
    return autoFlagged.filter(
      (item) =>
        item.id.toLowerCase().includes(q) ||
        (item.videoId || "").toLowerCase().includes(q) ||
        (item.commentId || "").toLowerCase().includes(q) ||
        (item.messageId || "").toLowerCase().includes(q) ||
        (item.snippet || "").toLowerCase().includes(q) ||
        item.categories.some((c) => c.toLowerCase().includes(q))
    );
  }, [autoFlagged, query]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authedFetch(`/api/admin/moderation?tab=${tab}`);
        if (!res.ok) throw new Error(`Couldn't load the queue (HTTP ${res.status}).`);
        const data = await res.json();
        if (cancelled) return;

        if (tab === "reports") {
          setReports(data.items || []);
          setTableMissing(Boolean(data.tableMissing));
        } else {
          setAutoFlagged(data.items || []);
        }
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

  const resolveReport = async (reportId: string) => {
    setBusyId(reportId);
    try {
      const res = await authedFetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (res.ok) setReports((prev) => prev.filter((r) => r.reportId !== reportId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const removeReportedContent = async (r: ReportItem) => {
    const path = contentAdminPath(r.targetType, r);
    if (!path) return;
    if (!window.confirm(`Permanently remove this ${r.targetType}? This can't be undone.`)) return;

    setBusyId(r.reportId);
    try {
      const res = await authedFetch(path, { method: "DELETE" });
      if (res.ok) {
        await authedFetch(`/api/admin/reports/${r.reportId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "resolved" }),
        });
        setReports((prev) => prev.filter((x) => x.reportId !== r.reportId));
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const restoreFlagged = async (item: AutoFlagItem) => {
    const path = contentAdminPath(item.contentType, item);
    if (!path) return;
    setBusyId(item.id);
    try {
      const res = await authedFetch(path, { method: "PATCH" });
      if (res.ok) setAutoFlagged((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const removeFlagged = async (item: AutoFlagItem) => {
    const path = contentAdminPath(item.contentType, item);
    if (!path) return;
    if (!window.confirm(`Permanently remove this ${item.contentType}? This can't be undone.`)) return;

    setBusyId(item.id);
    try {
      const res = await authedFetch(path, { method: "DELETE" });
      if (res.ok) setAutoFlagged((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">
          Reports & Moderation
        </h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real reports from viewers, plus anything InPlayer&apos;s AI moderation held back
          automatically before a human ever saw it.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
            tab === "reports"
              ? "bg-indigo-500 text-white"
              : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
          }`}
        >
          <Flag size={12} /> Reports
        </button>
        <button
          type="button"
          onClick={() => setTab("autoflagged")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
            tab === "autoflagged"
              ? "bg-indigo-500 text-white"
              : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
          }`}
        >
          <Bot size={12} /> Auto-flagged by AI
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by report ID, video/content ID, reason, or reporter…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {tableMissing && tab === "reports" && (
        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          The Reports table (InPlayer-Reports) hasn&apos;t been created in AWS yet, so reports
          can&apos;t be listed until it exists.
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
      ) : tab === "reports" ? (
        filteredReports.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
            <ShieldCheck size={28} className="text-emerald-400" />
            <p className="text-sm text-slate-500">
              {query ? `Nothing matches "${query}".` : "No open reports. All caught up."}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {filteredReports.map((r) => (
              <div
                key={r.reportId}
                className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300">
                    {r.targetType}
                  </span>
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300">
                    {reasonLabel(r.reason)}
                  </span>
                  {r.videoId && (
                    <Link
                      href={`/watch/${r.videoId}`}
                      target="_blank"
                      className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      <ExternalLink size={11} /> View video
                    </Link>
                  )}
                </div>

                <p className="mt-2 truncate text-sm text-slate-200 light:text-slate-800">
                  {r.snippet || "(content not available)"}
                </p>
                {r.details && (
                  <p className="mt-1 text-xs text-slate-500">&ldquo;{r.details}&rdquo;</p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resolveReport(r.reportId)}
                    disabled={busyId === r.reportId}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
                  >
                    <Check size={13} /> Mark resolved
                  </button>
                  <button
                    type="button"
                    onClick={() => removeReportedContent(r)}
                    disabled={busyId === r.reportId}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
                  >
                    {busyId === r.reportId ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    Remove content
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredAutoFlagged.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">
            {query ? `Nothing matches "${query}".` : "Nothing auto-flagged right now."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filteredAutoFlagged.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300">
                  {item.contentType}
                </span>
                {item.categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300"
                  >
                    {c.replace(/\//g, " · ")}
                  </span>
                ))}
                {item.videoId && item.contentType !== "message" && (
                  <Link
                    href={`/watch/${item.videoId}`}
                    target="_blank"
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
                  >
                    <ExternalLink size={11} /> View video
                  </Link>
                )}
              </div>

              <p className="mt-2 truncate text-sm text-slate-200 light:text-slate-800">
                {item.snippet || "(no text)"}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => restoreFlagged(item)}
                  disabled={busyId === item.id}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  <Check size={13} /> Restore
                </button>
                <button
                  type="button"
                  onClick={() => removeFlagged(item)}
                  disabled={busyId === item.id}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
                >
                  {busyId === item.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
