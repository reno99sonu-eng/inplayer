"use client";

import { authedFetch } from "@/app/lib/apiFetch";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Loader2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Music2,
  Play,
  Pause,
  Mic2,
  Disc3,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Flame,
} from "lucide-react";
import { MUSIC_GENRES } from "@/app/lib/musicTrack";

interface AdminMusicTrack {
  videoId: string;
  title: string;
  contentType: "music";
  status: string | null;
  visibility: string | null;
  views: number;
  uploaderId: string | null;
  uploaderName: string | null;
  thumbnailUrl: string | null;
  uploadedAt: string | null;
  category?: string | null;
  musicSettings?: {
    covers?: string[];
    coverIntervalSeconds?: number;
    lyrics?: { seconds: number; text: string }[];
    genre?: string;
    audioSha256?: string | null;
    declaredOwnership?: boolean;
  };
}

type StatusFilter = "all" | "ready" | "processing" | "error";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All Statuses" },
  { key: "ready", label: "Uploaded" },
  { key: "processing", label: "Processing" },
  { key: "error", label: "Failed" },
];

export default function AdminMusicPage() {
  const [tracks, setTracks] = useState<AdminMusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inline audio preview state
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Selected track for lyrics modal
  const [lyricsModalTrack, setLyricsModalTrack] = useState<AdminMusicTrack | null>(null);

  const fetchMusicTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/videos?type=music&status=${status}`);
      if (!res.ok) {
        throw new Error(`Failed to load music tracks: ${res.statusText}`);
      }
      const data = await res.json();
      setTracks(data.items || []);
    } catch (err: any) {
      console.error("Admin music fetch error:", err);
      setError(err.message || "Failed to fetch music tracks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusicTracks();
  }, [status]);

  const handleTogglePreview = (track: AdminMusicTrack) => {
    if (previewTrackId === track.videoId) {
      if (isPlayingPreview) {
        audioPreviewRef.current?.pause();
        setIsPlayingPreview(false);
      } else {
        audioPreviewRef.current?.play().catch(() => {});
        setIsPlayingPreview(true);
      }
      return;
    }

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }

    const audio = new Audio(`/api/videos/${track.videoId}/download`);
    audioPreviewRef.current = audio;
    setPreviewTrackId(track.videoId);
    setIsPlayingPreview(true);

    audio.play().catch((err) => {
      console.warn("Audio preview playback failed:", err);
      setIsPlayingPreview(false);
    });

    audio.onended = () => {
      setIsPlayingPreview(false);
      setPreviewTrackId(null);
    };
  };

  const handleDelete = async (videoId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete track "${title}"?`)) {
      return;
    }
    setDeletingId(videoId);
    try {
      const res = await authedFetch(`/api/admin/videos/${videoId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setTracks((prev) => prev.filter((t) => t.videoId !== videoId));
    } catch (err: any) {
      alert("Failed to delete track: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter tracks by search and genre
  const filteredTracks = tracks.filter((t) => {
    const genre = t.musicSettings?.genre || t.category || "Other";
    const matchGenre =
      genreFilter === "all" || genre.toLowerCase() === genreFilter.toLowerCase();
    const matchQuery =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.uploaderName && t.uploaderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.videoId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchGenre && matchQuery;
  });

  // Calculate statistics
  const totalStreams = tracks.reduce((acc, t) => acc + (t.views || 0), 0);
  const totalWithLyrics = tracks.filter(
    (t) => t.musicSettings?.lyrics && t.musicSettings.lyrics.length > 0
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header & Title ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <Music2 size={20} />
            </span>
            <h1 className="text-2xl font-black text-white light:text-slate-900">
              Music Studio
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Manage music releases, synced karaoke lyrics, album covers, copyright signatures, and streaming stats.
          </p>
        </div>

        <Link
          href="/upload?type=music"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold shadow-lg hover:bg-orange-600 transition"
        >
          <Sparkles size={15} />
          <span>Upload Music Track</span>
        </Link>
      </div>

      {/* ── KPI Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-4">
          <p className="text-xs font-bold text-slate-400">Total Tracks</p>
          <p className="text-2xl font-black text-white light:text-slate-900 mt-1">
            {tracks.length}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-4">
          <p className="text-xs font-bold text-slate-400">Total Streams</p>
          <p className="text-2xl font-black text-orange-400 mt-1">
            {totalStreams.toLocaleString()}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-4">
          <p className="text-xs font-bold text-slate-400">Synced Karaoke Tracks</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {totalWithLyrics}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-4">
          <p className="text-xs font-bold text-slate-400">Copyright Verified</p>
          <p className="text-2xl font-black text-amber-400 mt-1">
            {tracks.filter((t) => t.musicSettings?.declaredOwnership).length}
          </p>
        </div>
      </div>

      {/* ── Filters & Search ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.03] p-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                status === tab.key
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:text-white light:hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Genre Select */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, artist, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black/30 light:bg-white border border-white/10 light:border-black/10 text-white light:text-slate-900 outline-none focus:border-orange-500"
            />
          </div>

          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-black/30 light:bg-white border border-white/10 light:border-black/10 text-white light:text-slate-900 outline-none font-semibold"
          >
            <option value="all">All Genres</option>
            {MUSIC_GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Track List Table ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 light:border-black/10 bg-white/[0.02] light:bg-black/[0.02] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16">
            <Loader2 size={32} className="animate-spin text-orange-500 mb-3" />
            <p className="text-xs text-slate-400">Loading music library...</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="p-16 text-center">
            <Music2 size={36} className="mx-auto text-slate-500 mb-3" />
            <p className="text-sm font-semibold text-slate-300 light:text-slate-700">
              No music tracks found
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try changing the search query or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 light:border-black/10 bg-white/[0.02] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Genre</th>
                  <th className="py-3 px-4">Lyrics</th>
                  <th className="py-3 px-4">Streams</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Copyright</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 light:divide-black/5">
                {filteredTracks.map((track) => {
                  const isPreviewing =
                    previewTrackId === track.videoId && isPlayingPreview;
                  const cover =
                    track.thumbnailUrl ||
                    track.musicSettings?.covers?.[0] ||
                    "/recommendations/thumbnails/1.jpg";
                  const genre =
                    track.musicSettings?.genre || track.category || "Pop";
                  const lyricsCount = track.musicSettings?.lyrics?.length || 0;

                  return (
                    <tr
                      key={track.videoId}
                      className="hover:bg-white/[0.03] light:hover:bg-black/[0.02] transition"
                    >
                      {/* Track Info & Preview Play */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTogglePreview(track)}
                            className="relative flex h-11 w-11 shrink-0 rounded-xl overflow-hidden shadow group bg-black"
                            title="Preview audio"
                          >
                            <Image
                              src={cover}
                              alt={track.title}
                              fill
                              sizes="44px"
                              className="object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition">
                              {isPreviewing ? (
                                <Pause size={16} className="fill-white text-white" />
                              ) : (
                                <Play size={16} className="fill-white text-white translate-x-0.5" />
                              )}
                            </div>
                          </button>

                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-white light:text-slate-900 truncate">
                              {track.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {track.uploaderName || "Unknown Artist"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Genre */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {genre}
                        </span>
                      </td>

                      {/* Lyrics */}
                      <td className="py-3 px-4">
                        {lyricsCount > 0 ? (
                          <button
                            onClick={() => setLyricsModalTrack(track)}
                            className="inline-flex items-center gap-1 text-emerald-400 font-semibold hover:underline"
                          >
                            <Mic2 size={12} />
                            <span>{lyricsCount} lines</span>
                          </button>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>

                      {/* Streams */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-300 light:text-slate-700">
                        {track.views.toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            track.status === "error"
                              ? "bg-red-500/15 text-red-300"
                              : track.status === "processing"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                          }`}
                        >
                          {track.status === "error"
                            ? "Failed"
                            : track.status === "processing"
                            ? "Processing"
                            : "Uploaded"}
                        </span>
                      </td>

                      {/* Copyright */}
                      <td className="py-3 px-4">
                        {track.musicSettings?.declaredOwnership ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <ShieldCheck size={13} />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Standard</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/music?v=${track.videoId}`}
                            target="_blank"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white light:hover:text-slate-900 transition hover:bg-white/5"
                            title="Open in InPlayer Music"
                          >
                            <ExternalLink size={14} />
                          </Link>

                          <button
                            onClick={() => handleDelete(track.videoId, track.title)}
                            disabled={deletingId === track.videoId}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition hover:bg-rose-500/10"
                            title="Delete track"
                          >
                            {deletingId === track.videoId ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Synced Lyrics Viewer Modal ───────────────────────────────── */}
      {lyricsModalTrack && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#091424] light:bg-white border border-white/10 light:border-black/10 p-6 shadow-2xl text-white light:text-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 light:border-black/10 pb-3">
              <div>
                <h3 className="text-base font-bold truncate">{lyricsModalTrack.title}</h3>
                <p className="text-xs text-slate-400">Synchronized Lyrics Inspector</p>
              </div>
              <button
                onClick={() => setLyricsModalTrack(null)}
                className="p-1.5 rounded-full hover:bg-white/10 light:hover:bg-black/10"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 pr-2 font-mono text-xs">
              {lyricsModalTrack.musicSettings?.lyrics?.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5"
                >
                  <span className="text-orange-400 font-bold shrink-0">
                    {Math.floor(line.seconds / 60)}:
                    {(line.seconds % 60).toFixed(1).padStart(4, "0")}
                  </span>
                  <span className="text-slate-200 light:text-slate-800">{line.text}</span>
                </div>
              ))}
            </div>

            <div className="text-right pt-2 border-t border-white/10 light:border-black/10">
              <button
                onClick={() => setLyricsModalTrack(null)}
                className="px-4 py-2 rounded-xl bg-white/10 light:bg-black/10 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
