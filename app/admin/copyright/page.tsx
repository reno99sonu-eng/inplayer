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
  Bot,
  Scale,
  FileText,
  XCircle,
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
  autoFlagged?: boolean;
  isAppeal?: boolean;
  isFormalNotice?: boolean;
  complainantName?: string | null;
  complainantEmail?: string | null;
  complainantPhone?: string | null;
  workTitle?: string | null;
  workType?: string | null;
  ownershipBasis?: string | null;
  infringingUrl?: string | null;
  creatorName?: string | null;
  creatorEmail?: string | null;
  appealBasis?: string | null;
  explanation?: string | null;
  evidenceUrls?: string | null;
  signature?: string | null;
}

type SubTab = "all" | "complaints" | "appeals";

export default function CopyrightCenterPage() {
  const [items, setItems] = useState<CopyrightItem[]>([]);
  const [threshold, setThreshold] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [subTab, setSubTab] = useState<SubTab>("all");

  const complaintsCount = useMemo(() => items.filter((i) => !i.isAppeal).length, [items]);
  const appealsCount = useMemo(() => items.filter((i) => i.isAppeal).length, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (subTab === "complaints") {
      result = result.filter((i) => !i.isAppeal);
    } else if (subTab === "appeals") {
      result = result.filter((i) => i.isAppeal);
    }

    const q = query.trim().toLowerCase();
    if (!q) return result;

    return result.filter(
      (item) =>
        item.reportId.toLowerCase().includes(q) ||
        item.videoId.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.uploaderUsername || "").toLowerCase().includes(q) ||
        (item.uploaderId || "").toLowerCase().includes(q) ||
        (item.complainantName || "").toLowerCase().includes(q) ||
        (item.creatorName || "").toLowerCase().includes(q) ||
        (item.workTitle || "").toLowerCase().includes(q)
    );
  }, [items, subTab, query]);

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

  const acceptAppeal = async (item: CopyrightItem) => {
    const proceed = window.confirm(
      `Accept counter-notice for "${item.title}"? This will decrement the uploader's strike count, restore the video if hidden, and notify the creator.`
    );
    if (!proceed) return;

    setBusyId(item.reportId);
    try {
      const res = await authedFetch("/api/admin/copyright", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: item.reportId,
          action: "accept_appeal",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't accept appeal.");
      setItems((prev) => prev.filter((x) => x.reportId !== item.reportId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  const rejectAppeal = async (item: CopyrightItem) => {
    const proceed = window.confirm(
      `Reject counter-notice for "${item.title}"? The restriction/strike will remain in place and the creator will be notified.`
    );
    if (!proceed) return;

    setBusyId(item.reportId);
    try {
      const res = await authedFetch("/api/admin/copyright", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: item.reportId,
          action: "reject_appeal",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't reject appeal.");
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
          Statutory copyright complaints, automated screening notices, and creator counter-notices under
          the Indian Copyright Act, 1957.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
            subTab === "all"
              ? "bg-orange-500 text-white"
              : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
          }`}
        >
          All Items ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("complaints")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
            subTab === "complaints"
              ? "bg-red-500 text-white"
              : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
          }`}
        >
          <Copyright size={12} /> Complaints ({complaintsCount})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("appeals")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
            subTab === "appeals"
              ? "bg-cyan-600 text-white"
              : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
          }`}
        >
          <Scale size={12} /> Appeals &amp; Counter-Notices ({appealsCount})
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by video title, video ID, report ID, complainant, or uploader…"
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
          <Loader2 size={24} className="animate-spin text-orange-400" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-2 py-8 text-center">
          <ShieldCheck size={28} className="text-emerald-400" />
          <p className="text-sm text-slate-500">
            {query ? `Nothing matches "${query}".` : "No items in this queue. All caught up."}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredItems.map((item) => (
            <div
              key={item.reportId}
              className={`rounded-2xl border p-4 ${
                item.isAppeal
                  ? "border-cyan-500/30 bg-cyan-950/[0.08] light:border-cyan-200 light:bg-cyan-50"
                  : item.isFormalNotice
                  ? "border-red-500/30 bg-red-950/[0.08] light:border-red-200 light:bg-red-50"
                  : "border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {item.isAppeal ? (
                  <span className="flex items-center gap-1 rounded-full bg-cyan-500/20 light:bg-cyan-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-300 light:text-cyan-800">
                    <Scale size={10} /> Counter-Notice / Appeal
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-red-500/15 light:bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-300 light:text-red-700">
                    <Copyright size={10} /> Copyright Complaint
                  </span>
                )}

                {item.isFormalNotice && (
                  <span className="flex items-center gap-1 rounded-full bg-orange-500/20 light:bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-300 light:text-orange-800">
                    <FileText size={10} /> Formal Legal Notice
                  </span>
                )}

                {item.autoFlagged && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 light:bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300 light:text-amber-800">
                    <Bot size={10} /> Auto-flagged
                  </span>
                )}

                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                    item.currentStrikes >= threshold - 1
                      ? "bg-red-500/15 light:bg-red-100 text-red-300 light:text-red-700"
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

              <p className="mt-2 text-sm font-semibold text-white light:text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Uploader:{" "}
                <span className="font-semibold text-slate-200 light:text-slate-800">
                  {item.uploaderUsername ? `@${item.uploaderUsername}` : "(unknown account)"}
                </span>{" "}
                {item.uploaderId && <span className="text-[10px] opacity-60">({item.uploaderId})</span>}
              </p>

              {/* Formal complaint details */}
              {item.isFormalNotice && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs light:border-black/10 light:bg-white">
                  <p className="font-bold text-slate-300 light:text-slate-700">Complainant Information:</p>
                  <p className="mt-0.5 text-slate-400">
                    <strong>Claimant:</strong> {item.complainantName} ({item.complainantEmail}
                    {item.complainantPhone ? `, ${item.complainantPhone}` : ""})
                  </p>
                  <p className="text-slate-400">
                    <strong>Claimed Work:</strong> {item.workTitle} ({item.workType} &bull; {item.ownershipBasis})
                  </p>
                  {item.signature && (
                    <p className="text-slate-400">
                      <strong>Digital Signature:</strong> {item.signature}
                    </p>
                  )}
                </div>
              )}

              {/* Appeal / Counter-Notice details */}
              {item.isAppeal && (
                <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs light:border-cyan-200 light:bg-white">
                  <p className="font-bold text-cyan-300 light:text-cyan-800">Creator Counter-Notice &amp; Appeal:</p>
                  <p className="mt-0.5 text-slate-300 light:text-slate-700">
                    <strong>Creator:</strong> {item.creatorName || item.uploaderUsername} ({item.creatorEmail || "Account Email"})
                  </p>
                  <p className="mt-0.5 text-slate-300 light:text-slate-700">
                    <strong>Statutory Basis:</strong> <span className="font-mono text-cyan-400 light:text-cyan-700">{item.appealBasis}</span>
                  </p>
                  {item.explanation && (
                    <p className="mt-1 text-slate-300 light:text-slate-700">
                      <strong>Statement:</strong> &ldquo;{item.explanation}&rdquo;
                    </p>
                  )}
                  {item.evidenceUrls && (
                    <p className="mt-1 text-slate-300 light:text-slate-700">
                      <strong>Evidence / Documentation:</strong> {item.evidenceUrls}
                    </p>
                  )}
                  {item.signature && (
                    <p className="mt-1 text-slate-400">
                      <strong>Electronic Signature:</strong> {item.signature}
                    </p>
                  )}
                </div>
              )}

              {item.details && !item.isFormalNotice && !item.isAppeal && (
                <p className="mt-1 text-xs text-slate-400">&ldquo;{item.details}&rdquo;</p>
              )}

              {item.autoFlagged && (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-500/[0.07] px-2 py-1.5 text-[11px] leading-relaxed text-amber-200/90 light:bg-amber-50 light:text-amber-900">
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Automated scan match — no human complaint filed. Verify audio and permissions
                    before striking.
                  </span>
                </p>
              )}

              {/* Action Buttons */}
              <div className="mt-3 flex items-center gap-2">
                {item.isAppeal ? (
                  <>
                    <button
                      type="button"
                      onClick={() => acceptAppeal(item)}
                      disabled={busyId === item.reportId}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 light:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-300 light:text-emerald-700 transition hover:bg-emerald-500/25 light:hover:bg-emerald-200 disabled:opacity-60"
                    >
                      {busyId === item.reportId ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Check size={13} />
                      )}
                      Accept Appeal &amp; Remove Strike
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectAppeal(item)}
                      disabled={busyId === item.reportId}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 light:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-300 light:text-red-700 transition hover:bg-red-500/25 light:hover:bg-red-200 disabled:opacity-60"
                    >
                      <XCircle size={13} /> Reject Appeal
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => dismiss(item)}
                      disabled={busyId === item.reportId}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 light:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-300 light:text-emerald-700 transition hover:bg-emerald-500/25 light:hover:bg-emerald-200 disabled:opacity-60"
                    >
                      <Check size={13} /> Dismiss (No Strike)
                    </button>
                    <button
                      type="button"
                      onClick={() => strike(item)}
                      disabled={busyId === item.reportId || !item.uploaderId}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500/15 light:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-300 light:text-red-700 transition hover:bg-red-500/25 light:hover:bg-red-200 disabled:opacity-60"
                    >
                      {busyId === item.reportId ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Gavel size={13} />
                      )}
                      Issue Strike
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
