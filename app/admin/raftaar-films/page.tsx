"use client";

import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import Link from "next/link";
import {
  Film,
  Play,
  Trash2,
  ExternalLink,
  Search,
  Eye,
  Heart,
  Layers,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FILM_GENRES } from "@/app/lib/raftaarFilms";

interface SeriesItem {
  seriesId: string;
  creatorId: string;
  creatorName: string;
  creatorHandle?: string;
  creatorAvatarUrl?: string;
  title: string;
  genre: string;
  description?: string;
  posterUrl?: string;
  status: "draft" | "published" | "archived";
  episodeCount: number;
  totalViews?: number;
  totalLikes?: number;
  createdAt: string;
}

interface EpisodeItem {
  videoId: string;
  seriesId: string;
  title: string;
  episodeNumber: number;
  views?: number;
  likeCount?: number;
  thumbnailUrl?: string;
  uploadedAt: string;
}

export default function AdminRaftaarFilmsPage() {
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");

  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [episodesMap, setEpisodesMap] = useState<Record<string, EpisodeItem[]>>({});
  const [episodesLoading, setEpisodesLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch("/api/admin/raftaar-films/series", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSeriesList(data.series || []);
      }
    } catch (err) {
      console.error("Failed to load series:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (seriesId: string) => {
    if (episodesMap[seriesId]) {
      setExpandedSeriesId(expandedSeriesId === seriesId ? null : seriesId);
      return;
    }

    setEpisodesLoading(true);
    setExpandedSeriesId(seriesId);
    try {
      const res = await fetch(`/api/raftaar-films/series/${seriesId}/episodes`);
      if (res.ok) {
        const data = await res.json();
        setEpisodesMap((prev) => ({ ...prev, [seriesId]: data.episodes || [] }));
      }
    } catch (err) {
      console.error("Failed to load episodes:", err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    if (!confirm("Are you sure you want to delete this series and all its episodes permanently?")) return;

    setDeletingId(seriesId);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/admin/raftaar-films/series/${seriesId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSeriesList((prev) => prev.filter((s) => s.seriesId !== seriesId));
      }
    } catch (err) {
      console.error("Failed to delete series:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const totalEpisodes = seriesList.reduce((acc, curr) => acc + (curr.episodeCount || 0), 0);
  const totalViews = seriesList.reduce((acc, curr) => acc + (curr.totalViews || 0), 0);
  const totalLikes = seriesList.reduce((acc, curr) => acc + (curr.totalLikes || 0), 0);

  const filtered = seriesList.filter((s) => {
    if (selectedGenre !== "All" && s.genre !== selectedGenre) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.creatorName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-[#071120] p-5 light:border-black/10 light:bg-white">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
            <Film size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">
              Raftaar Films Content & Analytics
            </h1>
            <p className="text-xs text-slate-400 light:text-slate-600">
              Manage all published micro-drama series, episodes, and performance metrics
            </p>
          </div>
        </div>

        <Link
          href="/admin/raftaar-films-applications"
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500/15 px-4 py-2.5 text-xs font-bold text-orange-400 hover:bg-orange-500 hover:text-white transition"
        >
          Review Creator Applications →
        </Link>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <p className="text-xs font-medium text-slate-400">Total Series</p>
          <p className="mt-1 text-2xl font-black text-white light:text-slate-900">{seriesList.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <p className="text-xs font-medium text-slate-400">Total Episodes</p>
          <p className="mt-1 text-2xl font-black text-white light:text-slate-900">{totalEpisodes}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <p className="text-xs font-medium text-slate-400">Total Views</p>
          <p className="mt-1 text-2xl font-black text-white light:text-slate-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <p className="text-xs font-medium text-slate-400">Total Likes</p>
          <p className="mt-1 text-2xl font-black text-white light:text-slate-900">{totalLikes.toLocaleString()}</p>
        </div>
      </div>

      {/* Search & Genre Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-xl [scrollbar-width:none]">
          {["All", ...FILM_GENRES].map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                selectedGenre === g
                  ? "bg-orange-500 text-white shadow"
                  : "border border-white/10 bg-[#071120] text-slate-400 hover:text-white light:border-black/10 light:bg-white light:text-slate-600"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search series or creator..."
            className="w-full rounded-xl border border-white/10 bg-[#071120] pl-9 pr-3.5 py-2 text-xs text-white outline-none focus:border-orange-400 light:border-black/10 light:bg-white light:text-slate-900"
          />
        </div>
      </div>

      {/* Series Listing */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 size={30} className="animate-spin text-orange-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-12 text-center text-slate-400 light:border-black/10 light:bg-white">
          <AlertCircle size={32} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm font-semibold">No film series found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((series) => {
            const isExpanded = expandedSeriesId === series.seriesId;
            const eps = episodesMap[series.seriesId] || [];

            return (
              <div
                key={series.seriesId}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#071120] transition light:border-black/10 light:bg-white"
              >
                {/* Main Series Row */}
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <img
                      src={series.posterUrl || "/default-poster.png"}
                      alt={series.title}
                      className="h-20 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white light:text-slate-900 truncate">
                          {series.title}
                        </h3>
                        <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                          {series.genre}
                        </span>
                        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                          {series.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 truncate">
                        Creator: <strong className="text-slate-200">{series.creatorName}</strong> ({series.creatorId})
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                        <span>🎬 {series.episodeCount} Episodes</span>
                        <span>👁️ {(series.totalViews || 0).toLocaleString()} Views</span>
                        <span>❤️ {(series.totalLikes || 0).toLocaleString()} Likes</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => loadEpisodes(series.seriesId)}
                      className="inline-flex items-center gap-1 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <span>Episodes</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <Link
                      href={`/raftaar-films/${series.seriesId}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-xl bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
                      title="View Public Page"
                    >
                      <ExternalLink size={14} />
                    </Link>
                    <button
                      onClick={() => handleDeleteSeries(series.seriesId)}
                      disabled={deletingId === series.seriesId}
                      className="rounded-xl bg-red-500/15 p-2 text-red-400 hover:bg-red-500 hover:text-white transition disabled:opacity-50"
                      title="Delete Series"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded Episodes View */}
                {isExpanded && (
                  <div className="border-t border-white/10 bg-black/20 p-4 light:border-black/10 light:bg-black/[0.02]">
                    <h4 className="text-xs font-bold text-slate-300 light:text-slate-700 uppercase tracking-wider mb-3">
                      Episodes in this Series
                    </h4>

                    {episodesLoading ? (
                      <div className="py-4 text-center">
                        <Loader2 size={20} className="animate-spin text-orange-400 mx-auto" />
                      </div>
                    ) : eps.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">No episodes published in this series yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {eps.map((ep) => (
                          <div
                            key={ep.videoId}
                            className="flex items-center justify-between rounded-xl border border-white/5 bg-[#071120] p-3 light:border-black/5 light:bg-white"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-xs font-bold text-orange-400">
                                Ep {ep.episodeNumber}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white light:text-slate-900 truncate">
                                  {ep.title}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {ep.views || 0} views • {ep.likeCount || 0} likes
                                </p>
                              </div>
                            </div>

                            <Link
                              href={`/raftaar-films/${series.seriesId}/${ep.videoId}`}
                              target="_blank"
                              className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
                              title="Play Episode"
                            >
                              <Play size={13} />
                            </Link>
                          </div>
                        ))}
                      </div>
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
