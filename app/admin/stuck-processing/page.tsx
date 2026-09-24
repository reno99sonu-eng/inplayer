"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertOctagon, ShieldCheck, Search, Trash2 } from "lucide-react";

interface StuckVideo {
  videoId: string;
  title: string;
  uploaderName: string;
  contentType: string;
  uploadedAt: string;
  stuckHours: number;
}

// The one focused destination the "delete_stuck_processing_videos"
// permission unlocks (app/lib/isAdmin.ts) — a team member granted only
// this permission can see and delete videos/Shorts stuck in "processing"
// for over 2 hours, and nothing else about content management. Backed by
// app/api/admin/videos/stuck-processing/route.ts, which independently
// re-derives "is this actually stuck" server-side on every GET and DELETE
// rather than trusting anything the client sends, so this can never widen
// into "delete any video" no matter what this page does.
export default function AdminStuckProcessingPage() {
  const [videos, setVideos] = useState<StuckVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/videos/stuck-processing");
      if (!res.ok) throw new Error(`Couldn't load stuck uploads (HTTP ${res.status}).`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (() => {
      load();
    })();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.uploaderName.toLowerCase().includes(q) ||
        v.videoId.toLowerCase().includes(q)
    );
  }, [videos, query]);

  const removeOne = async (video: StuckVideo) => {
    if (!window.confirm(`Permanently delete "${video.title}"? This can't be undone.`)) return;
    setBusyId(video.videoId);
    try {
      const res = await authedFetch(`/api/admin/videos/stuck-processing?videoId=${encodeURIComponent(video.videoId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.videoId !== video.videoId));
      } else {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error || "Couldn't delete that video right now.");
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-xl font-black text-white light:text-slate-900">Stuck Uploads</h2>
        <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
          Videos and Shorts that have been sitting in &quot;processing&quot; for over 2 hours — a failed
          or hung Mux job. Deleting one here only removes that stuck upload; it doesn&apos;t touch
          anything else in Video Management. Refreshes itself every 30 seconds.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-4 py-3">
        <Search size={16} className="text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, uploader, or video ID…"
          className="w-full bg-transparent text-sm text-white light:text-slate-900 outline-none placeholder:text-slate-500"
        />
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300 light:text-red-700">
          <AlertOctagon size={16} className="mt-0.5 flex-shrink-0" />
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
            {query ? `Nothing matches "${query}".` : "Nothing stuck right now — everything's processing normally."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {filtered.map((v) => (
            <div
              key={v.videoId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-amber-500/15 light:bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300 light:text-amber-800">
                    {v.contentType}
                  </span>
                  <span className="rounded-md bg-red-500/15 light:bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-300 light:text-red-700">
                    Stuck {v.stuckHours}h
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold text-white light:text-slate-900">{v.title}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400 light:text-slate-600">
                  Uploaded by {v.uploaderName} · {new Date(v.uploadedAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === v.videoId}
                onClick={() => removeOne(v)}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 light:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-300 light:text-red-700 hover:bg-red-500/20 light:hover:bg-red-200 disabled:opacity-50"
              >
                {busyId === v.videoId ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
