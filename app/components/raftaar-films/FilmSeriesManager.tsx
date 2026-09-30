"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  Film,
  Plus,
  Play,
  Trash2,
  Edit,
  Eye,
  Heart,
  Layers,
  Sparkles,
  ChevronLeft,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { FILM_GENRES } from "@/app/lib/raftaarFilms";

interface SeriesItem {
  seriesId: string;
  title: string;
  genre: string;
  description?: string;
  posterUrl?: string;
  status: "draft" | "published" | "archived";
  episodeCount: number;
  totalViews?: number;
  totalLikes?: number;
  subscriberCount?: number;
  createdAt: string;
}

interface EpisodeItem {
  videoId: string;
  seriesId: string;
  title: string;
  episodeNumber: number;
  seasonNumber?: number;
  views?: number;
  thumbnailUrl?: string;
}

export default function FilmSeriesManager() {
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [appStatus, setAppStatus] = useState<"checking" | "none" | "pending" | "approved" | "rejected">("checking");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<SeriesItem | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // New series form
  const [newTitle, setNewTitle] = useState("");
  const [newGenre, setNewGenre] = useState<string>(FILM_GENRES[0]);
  const [newDescription, setNewDescription] = useState("");
  const [newPosterUrl, setNewPosterUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const getToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    checkStatusAndLoad();
  }, []);

  const checkStatusAndLoad = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setAppStatus("none");
        setLoading(false);
        return;
      }

      // Check application status
      const appRes = await fetch("/api/raftaar-films/apply", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (appRes.ok) {
        const appData = await appRes.json();
        if (appData.application) {
          setAppStatus(appData.application.status);
          if (appData.application.rejectionReason) {
            setRejectionReason(appData.application.rejectionReason);
          }
        } else {
          setAppStatus("none");
        }
      }

      // Fetch my series
      const seriesRes = await fetch("/api/raftaar-films/my-series", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (seriesRes.ok) {
        const data = await seriesRes.json();
        setSeriesList(data.series || []);
      }
    } catch (err) {
      console.error("Error loading film series data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEpisodes = async (seriesId: string) => {
    setEpisodesLoading(true);
    try {
      const res = await fetch(`/api/raftaar-films/series/${seriesId}/episodes`);
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data.episodes || []);
      }
    } catch (err) {
      console.error("Error fetching episodes:", err);
    } finally {
      setEpisodesLoading(false);
    }
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError("Series title is required.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in.");

      const res = await fetch("/api/raftaar-films/my-series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          genre: newGenre,
          description: newDescription.trim(),
          posterUrl: newPosterUrl.trim() || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600",
          status: "published",
          visibility: "public",
          categories: [newGenre],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to create series.");
      }

      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setNewPosterUrl("");
      await checkStatusAndLoad();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSeries = async (seriesId: string) => {
    if (!confirm("Are you sure you want to delete this series and all its episodes?")) return;
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/raftaar-films/my-series/${seriesId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSeriesList((prev) => prev.filter((s) => s.seriesId !== seriesId));
        if (selectedSeries?.seriesId === seriesId) setSelectedSeries(null);
      }
    } catch (err) {
      console.error("Failed to delete series:", err);
    }
  };

  const totalViews = seriesList.reduce((acc, curr) => acc + (curr.totalViews || 0), 0);
  const totalLikes = seriesList.reduce((acc, curr) => acc + (curr.totalLikes || 0), 0);
  const totalEpisodes = seriesList.reduce((acc, curr) => acc + (curr.episodeCount || 0), 0);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 size={30} className="animate-spin text-orange-400" />
      </div>
    );
  }

  // Not approved banner / view
  if (appStatus !== "approved") {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#071120] p-6 light:border-black/10 light:bg-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
            <Film size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white light:text-slate-900">Raftaar Films Studio</h2>
            <p className="text-xs text-slate-400 light:text-slate-600">Publish high-retention episodic vertical micro-dramas</p>
          </div>
        </div>

        {appStatus === "pending" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
            <div className="flex items-start gap-3">
              <Clock className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white">Application Under Review (48–72 Hours)</h4>
                <p className="mt-1 text-xs text-amber-300/90 leading-relaxed">
                  Your creator application for Raftaar Films was submitted and is currently being manually reviewed by our editorial team.
                  You will receive a notification in your bell icon as soon as an editorial decision is reached.
                </p>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-amber-400 font-semibold">
                  <span>⏱️ Average response time: 48 to 72 hours</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {appStatus === "rejected" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white">Application Needs Revision</h4>
                <p className="mt-1 text-xs text-red-300/90 leading-relaxed">
                  {rejectionReason || "Your application was not approved at this time. Please ensure your channel details and portfolio meet our production guidelines."}
                </p>
                <Link
                  href="/raftaar-films/apply"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-600"
                >
                  Update & Re-apply
                </Link>
              </div>
            </div>
          </div>
        )}

        {appStatus === "none" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center light:border-black/10">
            <Sparkles className="mx-auto h-12 w-12 text-orange-400 mb-3" />
            <h3 className="text-lg font-bold text-white light:text-slate-900">Become a Raftaar Films Creator</h3>
            <p className="mx-auto mt-2 max-w-md text-xs text-slate-400 light:text-slate-600 leading-relaxed">
              Raftaar Films is our dedicated vertical micro-drama format. Verified creators can release episodic series with dedicated channels, follower notifications, and built-in audience growth.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/raftaar-films/apply"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-3 text-xs font-bold text-white shadow-md transition hover:scale-105"
              >
                Apply for Raftaar Films (48–72h Review)
              </Link>
              <Link
                href="/raftaar-films"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-xs font-semibold text-slate-300 hover:bg-white/5 light:border-black/10 light:text-slate-700"
              >
                Explore Raftaar Films
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Selected Series Episode Manager View
  if (selectedSeries) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedSeries(null)}
          className="inline-flex items-center gap-2 text-xs font-bold text-orange-400 hover:text-orange-300 transition"
        >
          <ChevronLeft size={16} />
          Back to All Series
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <img
            src={selectedSeries.posterUrl || "/default-poster.png"}
            alt={selectedSeries.title}
            className="h-28 w-20 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/10"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white light:text-slate-900 truncate">{selectedSeries.title}</h2>
              <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                {selectedSeries.genre}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400 line-clamp-2">{selectedSeries.description || "No synopsis added."}</p>
            <p className="mt-2 text-xs text-slate-500">
              {selectedSeries.episodeCount} Episodes • {selectedSeries.totalViews || 0} Total Views
            </p>
          </div>
          <Link
            href={`/upload?type=film&seriesId=${selectedSeries.seriesId}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] to-[#FFD54A] px-4 py-2.5 text-xs font-bold text-white shadow transition hover:scale-105"
          >
            <Plus size={14} />
            Upload Episode
          </Link>
        </div>

        {/* Episode List */}
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-3">Series Episodes</h3>

          {episodesLoading ? (
            <div className="py-8 text-center">
              <Loader2 size={24} className="animate-spin text-orange-400 mx-auto" />
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs text-slate-400">No episodes uploaded yet for this series.</p>
              <Link
                href={`/upload?type=film&seriesId=${selectedSeries.seriesId}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-500/15 px-4 py-2 text-xs font-bold text-orange-400 hover:bg-orange-500 hover:text-white transition"
              >
                Upload Episode 1
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {episodes.map((ep) => (
                <div
                  key={ep.videoId}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-white/10 transition light:border-black/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-xs font-bold text-orange-400">
                      Ep {ep.episodeNumber}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white light:text-slate-900 truncate">{ep.title}</p>
                      <p className="text-[11px] text-slate-400">{ep.views || 0} views</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/raftaar-films/${selectedSeries.seriesId}/${ep.videoId}`}
                      className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
                      title="Watch Episode"
                    >
                      <Play size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Master Series Manager List View
  return (
    <div className="space-y-6">
      {/* Analytics Counter Banner */}
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
          <p className="text-xs font-medium text-slate-400">Film Views</p>
          <p className="mt-1 text-2xl font-black text-white light:text-slate-900">{totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
          <p className="text-xs font-medium text-slate-400">Total Likes</p>
          <p className="mt-1 text-2xl font-black text-white light:text-slate-900">{totalLikes.toLocaleString()}</p>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-[#071120] p-4 light:border-black/10 light:bg-white">
        <div>
          <h2 className="text-lg font-bold text-white light:text-slate-900">My Raftaar Film Series</h2>
          <p className="text-xs text-slate-400 light:text-slate-600">Create and curate episodic vertical stories</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-4 py-2.5 text-xs font-bold text-white shadow transition hover:scale-105"
        >
          <Plus size={15} />
          Create New Series
        </button>
      </div>

      {/* Series Grid */}
      {seriesList.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#071120] p-12 text-center light:border-black/10 light:bg-white">
          <Film className="mx-auto h-12 w-12 text-orange-400 mb-3" />
          <h3 className="text-sm font-bold text-white light:text-slate-900">No Series Created Yet</h3>
          <p className="mt-1 text-xs text-slate-400">Start your micro-drama journey by creating your first series title.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500/15 px-4 py-2 text-xs font-bold text-orange-400 hover:bg-orange-500 hover:text-white transition"
          >
            <Plus size={14} />
            Create First Series
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seriesList.map((series) => (
            <div
              key={series.seriesId}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#071120] transition hover:border-orange-400/40 light:border-black/10 light:bg-white"
            >
              <div className="relative aspect-[16/9] w-full bg-slate-800">
                {series.posterUrl ? (
                  <img src={series.posterUrl} alt={series.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-600">
                    <Film size={32} />
                  </div>
                )}
                <div className="absolute top-2.5 right-2.5">
                  <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                    {series.genre}
                  </span>
                </div>
              </div>

              <div className="flex-1 p-4">
                <h3 className="font-bold text-sm text-white light:text-slate-900 line-clamp-1">{series.title}</h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{series.description || "No description provided."}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>🎬 {series.episodeCount} episodes</span>
                  <span>👁️ {series.totalViews || 0} views</span>
                </div>
              </div>

              <div className="border-t border-white/10 p-3 grid grid-cols-2 gap-2 light:border-black/10">
                <button
                  onClick={() => {
                    setSelectedSeries(series);
                    fetchEpisodes(series.seriesId);
                  }}
                  className="rounded-xl bg-white/5 py-2 text-center text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition"
                >
                  Manage Episodes
                </button>
                <Link
                  href={`/upload?type=film&seriesId=${series.seriesId}`}
                  className="rounded-xl bg-orange-500/15 py-2 text-center text-xs font-bold text-orange-400 hover:bg-orange-500 hover:text-white transition"
                >
                  Upload Ep
                </Link>
                <button
                  onClick={() => handleDeleteSeries(series.seriesId)}
                  className="col-span-2 text-center py-1.5 text-[11px] font-medium text-red-400 hover:text-red-300 transition"
                >
                  Delete Series
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create New Series Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0B1526] p-6 shadow-2xl text-white light:border-black/15 light:bg-white light:text-slate-900">
            <h3 className="text-lg font-bold">Create New Film Series</h3>
            <p className="mt-1 text-xs text-slate-400">Set up a container for your episodes</p>

            {createError && <p className="mt-3 text-xs text-red-400">{createError}</p>}

            <form onSubmit={handleCreateSeries} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1">Series Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Adbhut"
                  className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-xs text-white outline-none focus:border-orange-400 light:border-black/10 light:bg-white light:text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Genre *</label>
                <select
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-xs text-white outline-none focus:border-orange-400 light:border-black/10 light:bg-white light:text-slate-900"
                >
                  {FILM_GENRES.map((g) => (
                    <option key={g} value={g} className="bg-slate-900 text-white">
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Synopsis / Story Description</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief synopsis of your series..."
                  className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-xs text-white outline-none focus:border-orange-400 light:border-black/10 light:bg-white light:text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Poster Image URL (9:16 portrait)</label>
                <input
                  type="url"
                  value={newPosterUrl}
                  onChange={(e) => setNewPosterUrl(e.target.value)}
                  placeholder="https://example.com/poster.jpg"
                  className="w-full rounded-xl border border-white/10 bg-[#060D18] px-3 py-2 text-xs text-white outline-none focus:border-orange-400 light:border-black/10 light:bg-white light:text-slate-900"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-gradient-to-r from-[#FF7A18] to-[#FFD54A] px-5 py-2 text-xs font-bold text-white shadow disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Series"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
