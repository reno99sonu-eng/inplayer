"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Loader2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Eye,
  Film,
  Video as VideoIcon,
  SlidersHorizontal,
  X,
  Baby,
  ShieldAlert,
  Users,
} from "lucide-react";
import { CONTENT_TYPE_LABEL, CONTENT_TYPE_WORD, normalizeContentType, watchHrefFor } from "@/app/lib/contentTypes";

interface AdminVideoRow {
  videoId: string;
  title: string;
  contentType: "video" | "short" | "music";
  status: string | null;
  visibility: string | null;
  views: number;
  uploaderId: string | null;
  uploaderName: string | null;
  thumbnailUrl: string | null;
  uploadedAt: string | null;
  audience?: "everyone" | "kids" | "adult";
  audienceDeclared?: "everyone" | "kids" | "adult" | null;
}

type TypeFilter = "all" | "video" | "short" | "music";
// Mirrors STATUS_VALUES in app/api/admin/videos/route.ts — every real value
// ever written to a video's `status` field. "ready" here also covers
// videos with no status attribute at all (pre-dates the field), same as
// the API's own "ready" filter.
type StatusFilter = "all" | "live" | "processing" | "ready" | "error";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "live", label: "Live" },
  { key: "processing", label: "Processing" },
  { key: "ready", label: "Uploaded" },
  { key: "error", label: "Failed" },
];

// One shared rule for where a piece of content is watched, so this page
// can never drift from the rest of the site as content types are added.
function watchHref(v: AdminVideoRow): string {
  return watchHrefFor(v.contentType, v.videoId);
}

// Status pill shown on each row — "ready" (the normal, working state) is
// intentionally silent, same as before this change; every other real value
// gets its own clearly distinct color so a glance down the list tells you
// which uploads need attention. (Previously checked for "errored", but
// nothing ever actually wrote that string — every failure path writes
// "error" instead, see app/api/webhooks/mux/route.ts and
// app/lib/selfHealVideo.ts — so failed uploads were silently rendered in
// the same amber as merely-processing ones. Fixed here.)
function statusBadge(status: string | null) {
  if (!status || status === "ready") return null;
  const color =
    status === "error"
      ? "bg-red-500/15 text-red-300 light:bg-red-100 light:text-red-700 font-bold"
      : status === "live"
      ? "bg-rose-500/15 text-rose-300 light:bg-rose-100 light:text-rose-700 font-bold"
      : "bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-800 font-bold";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${color}`}>
      {status === "error" ? "Failed" : status}
    </span>
  );
}

function audienceBadge(row: AdminVideoRow) {
  const aud = row.audience || "everyone";
  const color =
    aud === "kids"
      ? "bg-emerald-500/15 text-emerald-300 light:bg-emerald-100 light:text-emerald-700"
      : aud === "adult"
      ? "bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700"
      : "bg-sky-500/15 text-sky-300 light:bg-sky-100 light:text-sky-700";
  const label = aud === "kids" ? "Kids" : aud === "adult" ? "18+" : "Everyone";

  return (
    <span className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${color}`}>
      {label}
      {row.audienceDeclared && row.audienceDeclared !== aud && (
        <span className="opacity-70 font-normal"> (Orig: {row.audienceDeclared})</span>
      )}
    </span>
  );
}

export default function AdminVideosPage() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");
  const initialStatus = searchParams.get("status");
  const [type, setType] = useState<TypeFilter>(
    // Kept in sync with TYPE_VALUES in the API route — the Dashboard's
    // cards deep-link here as ?type=video / ?type=short / ?type=music, and
    // an unrecognised value has to fall back to "all" rather than 404.
    initialType === "short" || initialType === "video" || initialType === "music"
      ? initialType
      : "all"
  );
  const [status, setStatus] = useState<StatusFilter>(
    STATUS_TABS.some((t) => t.key === initialStatus) ? (initialStatus as StatusFilter) : "all"
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [rows, setRows] = useState<AdminVideoRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingAudienceRow, setEditingAudienceRow] = useState<AdminVideoRow | null>(null);
  const [savingAudience, setSavingAudience] = useState(false);

  const updateAudience = async (targetAudience: "everyone" | "kids" | "adult") => {
    if (!editingAudienceRow || savingAudience) return;
    setSavingAudience(true);
    try {
      const res = await authedFetch(`/api/admin/videos/${editingAudienceRow.videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: targetAudience }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update audience.");
      }
      setRows((prev) =>
        prev.map((r) =>
          r.videoId === editingAudienceRow.videoId ? { ...r, audience: targetAudience } : r
        )
      );
      setEditingAudienceRow(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update audience.");
    } finally {
      setSavingAudience(false);
    }
  };

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
        const params = new URLSearchParams();
        if (type !== "all") params.set("type", type);
        if (status !== "all") params.set("status", status);
        if (debouncedQuery) params.set("query", debouncedQuery);

        const res = await authedFetch(`/api/admin/videos?${params.toString()}`);
        if (!res.ok) throw new Error(`Couldn't load content (HTTP ${res.status}).`);
        const data = await res.json();
        if (!cancelled) {
          setRows(data.videos || []);
          setNextCursor(data.nextCursor || null);
          if (data.counts) setCounts(data.counts);
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
  }, [type, status, debouncedQuery]);

  const loadMore = async () => {
    if (!nextCursor || debouncedQuery) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (status !== "all") params.set("status", status);
      params.set("cursor", nextCursor);

      const res = await authedFetch(`/api/admin/videos?${params.toString()}`);
      if (!res.ok) throw new Error(`Couldn't load more (HTTP ${res.status}).`);
      const data = await res.json();
      setRows((prev) => [...prev, ...(data.videos || [])]);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoadingMore(false);
    }
  };

  const removeVideo = async (row: AdminVideoRow) => {
    const label = CONTENT_TYPE_WORD[normalizeContentType(row.contentType)];
    if (
      !window.confirm(
        `Permanently delete this ${label} — "${row.title}"? This removes it everywhere on InPlayer and can't be undone.`
      )
    ) {
      return;
    }

    setDeletingId(row.videoId);
    try {
      const res = await authedFetch(`/api/admin/videos/${row.videoId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't delete this.");
      setRows((prev) => prev.filter((r) => r.videoId !== row.videoId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Videos & Shorts</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Every upload on InPlayer — including processing and private/unlisted ones the public
          can&apos;t see.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([
          { id: "all", label: "All" },
          { id: "video", label: "Videos" },
          { id: "short", label: "Shorts" },
          { id: "music", label: "Music" },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              type === t.id
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-400 light:text-slate-700 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter — separate row from Type above so the two dimensions
          (content kind vs. processing state) stay visually distinct and can
          be combined freely, e.g. "Shorts" + "Processing" together. Counts
          come from the API's own computeStatusCounts, scoped to whichever
          Type tab is currently active. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              status === t.key
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white/5 text-slate-400 light:text-slate-700 light:bg-slate-200/80 hover:bg-white/10 hover:text-white light:hover:text-slate-900"
            }`}
          >
            {t.label}
            {t.key !== "all" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                  status === t.key ? "bg-white/20 text-white" : "bg-white/10 light:bg-black/10 text-slate-400 light:text-slate-700"
                }`}
              >
                {counts[t.key] ?? 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or video ID…"
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
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          {debouncedQuery ? `Nothing matches "${debouncedQuery}".` : "Nothing here yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div
              key={row.videoId}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-white/10 light:bg-black/10">
                  {row.thumbnailUrl ? (
                    <Image src={row.thumbnailUrl} alt={row.title} fill sizes="80px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {row.contentType === "short" ? (
                        <Film size={16} className="text-slate-500" />
                      ) : (
                        <VideoIcon size={16} className="text-slate-500" />
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-bold text-white light:text-slate-900">
                      {row.title}
                    </p>
                    {statusBadge(row.status)}
                    {audienceBadge(row)}
                    {row.visibility && row.visibility !== "public" && (
                      <span className="shrink-0 rounded-full bg-white/10 light:bg-black/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300 light:text-slate-700">
                        {row.visibility}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400 light:text-slate-600">
                    {CONTENT_TYPE_LABEL[normalizeContentType(row.contentType)]} · {row.uploaderName || "Unknown uploader"}
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <Eye size={11} /> {row.views.toLocaleString("en-IN")}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAudienceRow(row)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 light:border-black/10 px-3 py-2 text-xs font-semibold text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
                  title="Change & Sync Audience Channel"
                >
                  <SlidersHorizontal size={13} />
                  Audience
                </button>
                <Link
                  href={watchHref(row)}
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 light:border-black/10 px-3 py-2 text-xs font-semibold text-slate-300 light:text-slate-700 hover:bg-white/5 light:hover:bg-black/5"
                >
                  <ExternalLink size={13} />
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => removeVideo(row)}
                  disabled={deletingId === row.videoId}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/15 light:bg-red-100 px-3 py-2 text-xs font-bold text-red-300 light:text-red-700 transition hover:bg-red-500/25 light:hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === row.videoId ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Delete
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

      {/* Edit Audience Modal */}
      {editingAudienceRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-[#0B1526] p-6 shadow-2xl text-white light:border-black/15 light:bg-white light:text-slate-900">
            <button
              type="button"
              onClick={() => setEditingAudienceRow(null)}
              disabled={savingAudience}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white light:hover:bg-black/10 light:hover:text-slate-900"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <span className="inline-block rounded-full bg-orange-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-400">
                Admin Content Studio
              </span>
              <h3 className="mt-2 text-xl font-black">
                Channel / Sync Content Audience
              </h3>
              <p className="mt-1 text-xs text-slate-400 light:text-slate-600 truncate font-semibold">
                &ldquo;{editingAudienceRow.title}&rdquo;
              </p>
              {editingAudienceRow.audienceDeclared && (
                <p className="mt-1 text-xs text-amber-300 light:text-amber-700">
                  Creator selected: <span className="font-bold uppercase">{editingAudienceRow.audienceDeclared}</span> at upload
                </p>
              )}
            </div>

            <p className="mb-4 text-xs text-slate-300 light:text-slate-600">
              Select which audience segment this video should sync to across InPlayer platform feeds:
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={savingAudience}
                onClick={() => updateAudience("everyone")}
                className={`w-full flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                  (editingAudienceRow.audience || "everyone") === "everyone"
                    ? "border-sky-500 bg-sky-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 light:border-black/10 light:bg-black/[0.03] light:text-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👥</span>
                  <div>
                    <div className="font-bold text-sm">Everyone (General)</div>
                    <div className="text-[11px] text-slate-400 light:text-slate-600">Standard feed, music &amp; general audience</div>
                  </div>
                </div>
                {(editingAudienceRow.audience || "everyone") === "everyone" && (
                  <span className="text-xs font-bold text-sky-400">Current</span>
                )}
              </button>

              <button
                type="button"
                disabled={savingAudience}
                onClick={() => updateAudience("kids")}
                className={`w-full flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                  editingAudienceRow.audience === "kids"
                    ? "border-emerald-500 bg-emerald-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 light:border-black/10 light:bg-black/[0.03] light:text-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">👶</span>
                  <div>
                    <div className="font-bold text-sm">Kids (Family Safe)</div>
                    <div className="text-[11px] text-slate-400 light:text-slate-600">Shows in Kids mode &amp; normal feed</div>
                  </div>
                </div>
                {editingAudienceRow.audience === "kids" && (
                  <span className="text-xs font-bold text-emerald-400">Current</span>
                )}
              </button>

              <button
                type="button"
                disabled={savingAudience}
                onClick={() => updateAudience("adult")}
                className={`w-full flex items-center justify-between rounded-2xl border p-3.5 text-left transition-all ${
                  editingAudienceRow.audience === "adult"
                    ? "border-amber-500 bg-amber-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 light:border-black/10 light:bg-black/[0.03] light:text-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔞</span>
                  <div>
                    <div className="font-bold text-sm">18+ (Adult Content)</div>
                    <div className="text-[11px] text-slate-400 light:text-slate-600">Requires passkey to unlock in feeds</div>
                  </div>
                </div>
                {editingAudienceRow.audience === "adult" && (
                  <span className="text-xs font-bold text-amber-400">Current</span>
                )}
              </button>
            </div>

            {savingAudience && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-orange-400">
                <Loader2 size={16} className="animate-spin" /> Syncing with DynamoDB &amp; platform feeds…
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-3 light:border-black/10">
              <button
                type="button"
                onClick={() => setEditingAudienceRow(null)}
                disabled={savingAudience}
                className="w-full rounded-xl py-2 text-center text-xs font-semibold text-slate-400 hover:text-white light:text-slate-600 light:hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
