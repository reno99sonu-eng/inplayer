"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Pause,
  Music2,
  TrendingUp,
  Sparkles,
  Flame,
  Radio,
  Disc3,
  Mic2,
  Heart,
  Share2,
  Volume2,
  Bell,
  Check,
  ChevronRight,
  ListPlus,
} from "lucide-react";
import { useMusicPlayer, type MusicTrack } from "@/app/context/MusicPlayerContext";
import LiveListeningToasts from "./LiveListeningToasts";
import { MUSIC_GENRES, type MusicGenre } from "@/app/lib/musicTrack";

const GENRE_GRADIENTS: Record<string, string> = {
  Pop: "from-pink-500/30 to-rose-600/30 border-pink-500/30",
  "Hip-Hop": "from-amber-500/30 to-orange-600/30 border-amber-500/30",
  "R&B": "from-purple-500/30 to-indigo-600/30 border-purple-500/30",
  Rock: "from-red-600/30 to-rose-700/30 border-red-500/30",
  Electronic: "from-cyan-500/30 to-blue-600/30 border-cyan-500/30",
  Classical: "from-emerald-500/30 to-teal-600/30 border-emerald-500/30",
  Folk: "from-yellow-600/30 to-amber-700/30 border-yellow-500/30",
  Indie: "from-violet-500/30 to-fuchsia-600/30 border-violet-500/30",
  Devotional: "from-orange-500/30 to-red-600/30 border-orange-500/30",
  Bollywood: "from-rose-500/30 to-pink-600/30 border-rose-500/30",
  Instrumental: "from-blue-500/30 to-indigo-600/30 border-blue-500/30",
  Other: "from-slate-600/30 to-slate-800/30 border-slate-500/30",
};

interface MusicPageClientProps {
  tracks: MusicTrack[];
  topArtists: {
    id: string;
    name: string;
    username?: string;
    avatarUrl?: string;
    tracksCount: number;
  }[];
}

export default function MusicPageClient({
  tracks,
  topArtists,
}: MusicPageClientProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } =
    useMusicPlayer();
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [subscribedArtists, setSubscribedArtists] = useState<Set<string>>(
    new Set()
  );

  // Spotlight Track (First track or popular)
  const spotlight = tracks[0] || null;

  // Filtered tracks based on Genre and Search Query
  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      const matchGenre =
        selectedGenre === "All" ||
        (t.genre && t.genre.toLowerCase() === selectedGenre.toLowerCase());
      const matchSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.artist.toLowerCase().includes(searchQuery.toLowerCase());
      return matchGenre && matchSearch;
    });
  }, [tracks, selectedGenre, searchQuery]);

  const toggleArtistNotify = (artistId: string) => {
    setSubscribedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(artistId)) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
  };

  return (
    <div className="min-h-screen pb-36 pt-4 text-white light:text-slate-900">
      {/* Real-time Listening Toast Notification */}
      <LiveListeningToasts tracks={tracks} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* ── 1. ULTRA-PREMIUM SPOTLIGHT HERO ───────────────────────── */}
        {spotlight && (
          <section className="relative overflow-hidden rounded-[32px] border border-white/10 light:border-black/10 bg-gradient-to-br from-[#0c182c] via-[#07101e] to-[#040810] light:from-[#FFF8EE] light:via-[#FAF1E4] light:to-[#F5E6D0] p-6 sm:p-10 shadow-[0_20px_70px_rgba(0,0,0,0.6)]">
            {/* Ambient Background Aura */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-orange-500/20 blur-[100px]" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-amber-500/15 blur-[100px]" />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 lg:gap-12">
              {/* Album Art with Vinyl Vibe */}
              <div className="relative group shrink-0">
                <div className="relative h-60 w-60 sm:h-72 sm:w-72 rounded-3xl overflow-hidden shadow-2xl border border-white/15 light:border-black/15 bg-black">
                  <Image
                    src={spotlight.covers[0] || "/recommendations/thumbnails/1.jpg"}
                    alt={spotlight.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 240px, 288px"
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                {/* Pulsing Disc Badge */}
                <div className="absolute -bottom-3 -right-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg border-2 border-[#0c182c] light:border-[#FFF8EE]">
                  <Disc3 size={24} className="animate-spin" style={{ animationDuration: "6s" }} />
                </div>
              </div>

              {/* Spotlight Info */}
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={13} />
                  <span>Featured Release</span>
                </div>

                <div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight drop-shadow-sm">
                    {spotlight.title}
                  </h1>
                  <p className="mt-2 text-base sm:text-lg font-semibold text-slate-300 light:text-slate-700">
                    {spotlight.artist}
                  </p>
                </div>

                {spotlight.lyrics && spotlight.lyrics.length > 0 && (
                  <div className="inline-block max-w-md rounded-2xl bg-white/5 light:bg-black/5 border border-white/10 light:border-black/10 px-4 py-2 text-xs font-medium text-slate-300 light:text-slate-600 italic">
                    &ldquo;{spotlight.lyrics[0].text}&rdquo;
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                  <button
                    onClick={() => {
                      if (currentTrack?.videoId === spotlight.videoId) {
                        togglePlay();
                      } else {
                        playTrack(spotlight, tracks);
                      }
                    }}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(249,115,22,0.5)] transition hover:scale-105 active:scale-95"
                  >
                    {currentTrack?.videoId === spotlight.videoId && isPlaying ? (
                      <>
                        <Pause size={18} className="fill-white" />
                        <span>Pause Track</span>
                      </>
                    ) : (
                      <>
                        <Play size={18} className="fill-white" />
                        <span>Play Spotlight</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => addToQueue(spotlight)}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 light:bg-black/10 hover:bg-white/20 light:hover:bg-black/20 text-white light:text-slate-900 font-semibold text-xs transition"
                  >
                    <ListPlus size={16} />
                    <span>Add to Queue</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 2. GENRE SELECTION PILLS ────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
              <Disc3 size={22} className="text-orange-400" />
              <span>Browse by Genre</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedGenre("All")}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedGenre === "All"
                  ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                  : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 border border-white/10 light:border-black/10"
              }`}
            >
              All Genres
            </button>
            {MUSIC_GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedGenre === genre
                    ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                    : "bg-white/5 light:bg-black/5 text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 border border-white/10 light:border-black/10"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </section>

        {/* ── 3. TRENDING MUSIC TRACKS ────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
              <Flame size={22} className="text-orange-400" />
              <span>Trending Music</span>
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {filteredTracks.length} tracks
            </span>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 light:border-black/15 p-12 text-center">
              <Music2 size={36} className="mx-auto text-slate-500 mb-3" />
              <p className="text-sm font-semibold text-slate-300 light:text-slate-700">
                No tracks found in &ldquo;{selectedGenre}&rdquo;
              </p>
              <button
                onClick={() => setSelectedGenre("All")}
                className="mt-4 px-4 py-2 rounded-xl bg-orange-500 text-xs font-bold text-white"
              >
                Show All Tracks
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {filteredTracks.map((track, idx) => {
                const isCurrent = currentTrack?.videoId === track.videoId;
                const cover = track.covers[0] || "/recommendations/thumbnails/1.jpg";

                return (
                  <div
                    key={track.videoId}
                    className="group relative flex flex-col rounded-2xl bg-white/[0.03] light:bg-black/[0.03] border border-white/10 light:border-black/10 p-3 hover:bg-white/[0.08] light:hover:bg-black/[0.06] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
                    onClick={() => {
                      if (isCurrent) togglePlay();
                      else playTrack(track, tracks);
                    }}
                  >
                    {/* Cover Art */}
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/40">
                      <Image
                        src={cover}
                        alt={track.title}
                        fill
                        sizes="(max-width: 640px) 160px, 200px"
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />

                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                          {isCurrent && isPlaying ? (
                            <Pause size={20} className="fill-white" />
                          ) : (
                            <Play size={20} className="fill-white translate-x-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Genre Tag */}
                      {track.genre && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-bold rounded-full bg-black/60 backdrop-blur-md text-orange-400 border border-white/10">
                          {track.genre}
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-bold truncate text-white light:text-slate-900 group-hover:text-orange-400 transition">
                        {track.title}
                      </p>
                      <p className="text-xs font-medium text-slate-400 light:text-slate-600 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 4. TOP MUSIC ARTISTS & CREATORS ─────────────────────────── */}
        {topArtists.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
              <Mic2 size={22} className="text-orange-400" />
              <span>Featured Artists</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topArtists.map((artist) => {
                const isNotified = subscribedArtists.has(artist.id);

                return (
                  <div
                    key={artist.id}
                    className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.03] light:bg-black/[0.03] border border-white/10 light:border-black/10 hover:border-orange-500/30 transition"
                  >
                    <Link
                      href={artist.username ? `/u/${artist.username}` : `/channel?id=${artist.id}`}
                      className="group"
                    >
                      <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-orange-400/40 group-hover:border-orange-400 shadow-md">
                        <Image
                          src={artist.avatarUrl || "/avatars/avatar.png"}
                          alt={artist.name}
                          fill
                          sizes="80px"
                          className="object-cover group-hover:scale-105 transition"
                        />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white light:text-slate-900 truncate max-w-[120px]">
                        {artist.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {artist.tracksCount} tracks
                      </p>
                    </Link>

                    {/* Notification Sync Button */}
                    <button
                      onClick={() => toggleArtistNotify(artist.id)}
                      className={`mt-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                        isNotified
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/5 light:bg-black/5 text-slate-400 hover:text-orange-400 border border-white/10 light:border-black/10"
                      }`}
                      title={isNotified ? "Notifications active" : "Get notified for new releases"}
                    >
                      <Bell size={11} className={isNotified ? "fill-emerald-400" : ""} />
                      <span>{isNotified ? "Synced" : "Sync"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
