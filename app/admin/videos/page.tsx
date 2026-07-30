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
} from "lucide-react";

interface AdminVideoRow {
  videoId: string;
  title: string;
  contentType: "video" | "short";
  status: string | null;
  visibility: string | null;
  views: number;
  uploaderId: string | null;
  uploaderName: string | null;
  thumbnailUrl: string | null;
  uploadedAt: string | null;
}

type TypeFilter = "all" | "video" | "short";


function watchHref(v: AdminVideoRow): string {
  return v.contentType === "short" ? `/shorts?v=${v.videoId}` : `/watch/${v.videoId}`;
}

function statusBadge(status: string | null) {
  if (!status || status === "ready") return null;
  const color =
    status === "errored"
      ? "bg-red-500/15 text-red-300"
      : "bg-amber-500/15 text-amber-300";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${color}`}>
      {status}
    </span>
  );
}

export default function AdminVideosPage() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type");
  const [type, setType] = useState<TypeFilter>(
    initialType === "short" || initialType === "video" ? initialType : "all"
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [rows, setRows] = useState<AdminVideoRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        if (debouncedQuery) params.set("query", debouncedQuery);

        const res = await authedFetch(`/api/admin/videos?${params.toString()}`);
        if (!res.ok) throw new Error(`Couldn't load content (HTTP ${res.status}).`);
        const data = await res.json();
        if (!cancelled) {
          setRows(data.videos || []);
          setNextCursor(data.nextCursor || null);
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
  }, [type, debouncedQuery]);

  const loadMore = async () => {
    if (!nextCursor || debouncedQuery) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
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
    const label = row.contentType === "short" ? "Short" : "video";
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
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              type === t.id
                ? "bg-indigo-500 text-white"
                : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
            }`}
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
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-white light:text-slate-900">
                      {row.title}
                    </p>
                    {statusBadge(row.status)}
                    {row.visibility && row.visibility !== "public" && (
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300">
                        {row.visibility}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400 light:text-slate-600">
                    {row.contentType === "short" ? "Short" : "Video"} · {row.uploaderName || "Unknown uploader"}
                    {" · "}
                    <span className="inline-flex items-center gap-1">
                      <Eye size={11} /> {row.views.toLocaleString("en-IN")}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
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
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}
