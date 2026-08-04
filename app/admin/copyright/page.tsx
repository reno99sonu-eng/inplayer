"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  Copyright,
  ExternalLink,
  Check,
  Gavel,
  ShieldCheck,
  ShieldAlert,
  Search,
} from "lucide-react";

interface CopyrightItem {
  reportId: string;
  videoId: string;
  title: string;
  uploaderId: string | null;
  uploaderUsername: string | null;
  reporterId: string;
  details: string;
  createdAt: string;
  currentStrikes: number;
}


export default function CopyrightCenterPage() {
  const [items, setItems] = useState<CopyrightItem[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.reportId.toLowerCase().includes(q) ||
        item.videoId.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.uploaderUsername || "").toLowerCase().includes(q) ||
        (item.uploaderId || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/copyright");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Couldn't load the queue (HTTP ${res.status}).`);
      setItems(data.items || []);
      setThreshold(data.strikeThreshold || 3);
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

  const dismiss = async (item: CopyrightItem) => {
    if (!window.confirm("Dismiss this copyright report with no strike issued?")) return;
    setBusyId(item.reportId);
    try {
      const res = await authedFetch("/api/admin/copyright", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: item.reportId, action: "dismiss" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't dismiss that report.");
      setItems((prev) => prev.filter((x) => x.reportId !== item.reportId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const strike = async (item: CopyrightItem) => {
    const nextCount = item.currentStrikes + 1;
    const willSuspend = nextCount >= threshold;
    const proceed = window.confirm(
      `Issue a copyright strike to @${item.uploaderUsername || "this uploader"}? This will be strike ${nextCount}/${threshold}${
        willSuspend ? " and will auto-suspend the account." : "."
      }`
    );
    if (!proceed) return;

    const removeVideo = window.confirm(
      `Also permanently remove the video "${item.title}"? Click OK to remove it too, or Cancel to strike only and leave the video up.`
    );

    setBusyId(item.reportId);
    try {
      const res = await authedFetch("/api/admin/copyright", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: item.reportId,
          action: "strike",
          removeVideo: removeVideo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't issue that strike.");
      setItems((prev) => prev.filter((x) => x.reportId !== item.reportId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Copyright Center</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Real user-submitted copyright reports on videos and Shorts. Issuing a strike
          permanently increments the uploader&apos;s real strike count — reaching{" "}
          {threshold} strikes auto-suspends their account, the same way a manual suspend does.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by video title, video ID, report ID, or uploader…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {tableMissing && (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-300 light:text-amber-700">
          The Reports table (InPlayer-Reports) hasn&apos;t been created in AWS yet, so copyright
          reports can&apos;t be listed until it exists.
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
      ) : filteredItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">
            {query ? `Nothing matches "${query}".` : "No open copyright reports. All caught up."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.reportId}
              className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300">
                  <Copyright size={10} /> Copyright
                </span>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                    item.currentStrikes >= threshold - 1
                      ? "bg-red-500/15 text-red-300"
                      : "bg-white/10 light:bg-black/10 text-slate-300 light:text-slate-700"
                  }`}
                >
                  {item.currentStrikes >= threshold - 1 && <ShieldAlert size={10} />}
                  {item.currentStrikes}/{threshold} strikes
                </span>
                <Link
                  href={`/watch/${item.videoId}`}
                  target="_blank"
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  <ExternalLink size={11} /> View video
                </Link>
              </div>

              <p className="mt-2 text-sm text-slate-200 light:text-slate-800">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Uploaded by{" "}
                {item.uploaderUsername ? `@${item.uploaderUsername}` : "(unknown account)"}
              </p>
              {item.details && (
                <p className="mt-1 text-xs text-slate-500">&ldquo;{item.details}&rdquo;</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dismiss(item)}
                  disabled={busyId === item.reportId}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  <Check size={13} /> Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => strike(item)}
                  disabled={busyId === item.reportId || !item.uploaderId}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-60"
                >
                  {busyId === item.reportId ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Gavel size={13} />
                  )}
                  Issue strike
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
