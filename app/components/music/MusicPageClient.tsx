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
  Clock3,
  Search,
  CheckCircle2,
} from "lucide-react";
import { useMusicPlayer, type MusicTrack } from "@/app/context/MusicPlayerContext";
import LiveListeningToasts from "./LiveListeningToasts";
import { MUSIC_GENRES } from "@/app/lib/musicTrack";

const SPOTIFY_GENRE_CARDS = [
  { id: "Pop", name: "Pop", color: "from-[#8C1932] to-[#B02A4B]", iconCover: "/recommendations/thumbnails/1.jpg" },
  { id: "Hip-Hop", name: "Hip-Hop", color: "from-[#BC5900] to-[#E67E22]", iconCover: "/recommendations/thumbnails/2.jpg" },
  { id: "Rock", name: "Rock", color: "from-[#E91429] to-[#990011]", iconCover: "/recommendations/thumbnails/3.jpg" },
  { id: "Electronic", name: "Electronic", color: "from-[#006450] to-[#16A085]", iconCover: "/recommendations/thumbnails/4.jpg" },
  { id: "R&B", name: "R&B", color: "from-[#8D67AB] to-[#5B2C6F]", iconCover: "/recommendations/thumbnails/5.jpg" },
  { id: "Indie", name: "Indie", color: "from-[#503750] to-[#2C3E50]", iconCover: "/recommendations/thumbnails/1.jpg" },
  { id: "Classical", name: "Classical", color: "from-[#477D95] to-[#2980B9]", iconCover: "/recommendations/thumbnails/2.jpg" },
  { id: "Devotional", name: "Devotional", color: "from-[#D84000] to-[#E67E22]", iconCover: "/recommendations/thumbnails/3.jpg" },
  { id: "Bollywood", name: "Bollywood", color: "from-[#BA5D07] to-[#F39C12]", iconCover: "/recommendations/thumbnails/4.jpg" },
  { id: "Instrumental", name: "Instrumental", color: "from-[#1E3264] to-[#2471A3]", iconCover: "/recommendations/thumbnails/5.jpg" },
];

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "3:18";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [subscribedArtists, setSubscribedArtists] = useState<Set<string>>(
    new Set()
  );

  // Spotlight Track (First track or popular)
  const spotlight = tracks[0] || null;

  // Quick Access Shelf: Top 6 tracks
  const quickAccessTracks = useMemo(() => tracks.slice(0, 6), [tracks]);

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
    <div className="min-h-screen bg-[#121212] pb-36 text-white selection:bg-[#1DB954] selection:text-black">
      {/* Real-time Listening Toast Notification */}
      <LiveListeningToasts tracks={tracks} />

      {/* Atmospheric Top Glow (Spotify signature dark forest mesh) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-[#1a3826] via-[#121212]/80 to-[#121212]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-10">
        {/* ── 1. SPOTIFY PILL NAVIGATION BAR ────────────────────────── */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedGenre("All")}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedGenre === "All"
                  ? "bg-white text-black shadow-md scale-105"
                  : "bg-[#282828] text-slate-200 hover:bg-[#383838]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedGenre("Pop")}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedGenre === "Pop"
                  ? "bg-white text-black shadow-md scale-105"
                  : "bg-[#282828] text-slate-200 hover:bg-[#383838]"
              }`}
            >
              Music
            </button>
            {MUSIC_GENRES.slice(0, 8).map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  selectedGenre === genre
                    ? "bg-white text-black shadow-md scale-105"
                    : "bg-[#282828] text-slate-200 hover:bg-[#383838]"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="What do you want to play?"
              className="w-full rounded-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] py-2 pl-10 pr-4 text-xs font-semibold text-white placeholder-slate-400 border border-transparent focus:border-white/20 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {/* ── 2. SPOTIFY QUICK-ACCESS TOP SHELF (2-Row Grid) ────────── */}
        {quickAccessTracks.length > 0 && selectedGenre === "All" && !searchQuery && (
          <section className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Good listening
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickAccessTracks.map((track) => {
                const isCurrent = currentTrack?.videoId === track.videoId;
                const cover = track.covers[0] || "/recommendations/thumbnails/1.jpg";

                return (
                  <div
                    key={`quick-${track.videoId}`}
                    onClick={() => {
                      if (isCurrent) togglePlay();
                      else playTrack(track, tracks);
                    }}
                    className="group relative flex items-center rounded-lg bg-[#242424]/70 hover:bg-[#333333] transition-all duration-200 overflow-hidden cursor-pointer shadow-sm hover:shadow-xl border border-white/[0.04]"
                  >
                    {/* 1:1 Square Album Cover without distortion */}
                    <div className="relative h-16 w-16 aspect-square shrink-0 bg-black">
                      <Image
                        src={cover}
                        alt={track.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>

                    {/* Title & Artist */}
                    <div className="min-w-0 flex-1 px-4 py-2">
                      <p className="font-bold text-sm text-white truncate group-hover:text-white">
                        {track.title}
                      </p>
                      <p className="text-xs text-[#B3B3B3] truncate">
                        {track.artist}
                      </p>
                    </div>

                    {/* Floating Green Play Button (Signature Spotify) */}
                    <div className="pr-4 shrink-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954] text-black shadow-[0_8px_16px_rgba(0,0,0,0.5)] transition-all duration-200 transform ${
                          isCurrent
                            ? "opacity-100 scale-100"
                            : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105"
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause size={18} className="fill-black" />
                        ) : (
                          <Play size={18} className="fill-black translate-x-0.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 3. SPOTIFY HERO SPOTLIGHT BANNER ──────────────────────── */}
        {spotlight && selectedGenre === "All" && !searchQuery && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3826] via-[#181818] to-[#121212] p-6 sm:p-8 border border-white/10 shadow-2xl">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 lg:gap-10">
              {/* Album Art with clean 1:1 aspect ratio */}
              <div className="relative group shrink-0">
                <div className="relative h-52 w-52 sm:h-64 sm:w-64 aspect-square rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.7)] border border-white/15 bg-black">
                  <Image
                    src={spotlight.covers[0] || "/recommendations/thumbnails/1.jpg"}
                    alt={spotlight.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 208px, 256px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>

                {/* Animated Disc Badge peek */}
                <div className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#1DB954] text-black shadow-lg border-2 border-[#181818]">
                  <Disc3
                    size={22}
                    className="animate-spin"
                    style={{ animationDuration: "5s" }}
                  />
                </div>
              </div>

              {/* Spotlight Info */}
              <div className="flex-1 text-center md:text-left space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles size={12} className="text-[#1DB954]" />
                  <span>Featured Release</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
                  {spotlight.title}
                </h1>

                <div className="flex items-center justify-center md:justify-start gap-2 text-sm font-semibold text-[#B3B3B3]">
                  {spotlight.uploaderAvatarUrl && (
                    <div className="relative h-6 w-6 rounded-full overflow-hidden shrink-0">
                      <Image
                        src={spotlight.uploaderAvatarUrl}
                        alt={spotlight.artist}
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <span className="text-white hover:underline cursor-pointer">
                    {spotlight.artist}
                  </span>
                  <span>•</span>
                  <span>{spotlight.genre || "Music"}</span>
                  <span>•</span>
                  <span>{formatDuration(spotlight.duration)}</span>
                </div>

                {spotlight.lyrics && spotlight.lyrics.length > 0 && (
                  <p className="text-xs text-slate-300 italic line-clamp-1 max-w-lg">
                    &ldquo;{spotlight.lyrics[0].text}&rdquo;
                  </p>
                )}

                {/* Main Actions: Giant Spotify Green Button */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-3">
                  <button
                    onClick={() => {
                      if (currentTrack?.videoId === spotlight.videoId) {
                        togglePlay();
                      } else {
                        playTrack(spotlight, tracks);
                      }
                    }}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-[#1DB954] hover:bg-[#1ED760] text-black font-extrabold text-sm shadow-[0_8px_24px_rgba(29,185,84,0.4)] transition hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    {currentTrack?.videoId === spotlight.videoId && isPlaying ? (
                      <>
                        <Pause size={20} className="fill-black" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play size={20} className="fill-black translate-x-0.5" />
                        <span>Play Spotlight</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => addToQueue(spotlight)}
                    className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <ListPlus size={16} />
                    <span>Add to Queue</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 4. POPULAR TRACKS TABLE (Spotify Signature View) ───────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <Flame size={22} className="text-[#1DB954]" />
              <span>
                {selectedGenre === "All"
                  ? "Popular Tracks"
                  : `${selectedGenre} Hits`}
              </span>
            </h2>
            <span className="text-xs font-semibold text-[#B3B3B3]">
              {filteredTracks.length} songs
            </span>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#181818] p-12 text-center">
              <Music2 size={36} className="mx-auto text-slate-500 mb-3" />
              <p className="text-sm font-semibold text-slate-300">
                No songs found in &ldquo;{selectedGenre}&rdquo;
              </p>
              <button
                onClick={() => setSelectedGenre("All")}
                className="mt-4 px-4 py-2 rounded-full bg-[#1DB954] text-xs font-bold text-black"
              >
                Browse All Music
              </button>
            </div>
          ) : (
            <div className="bg-[#181818]/60 border border-white/[0.06] rounded-2xl p-2 sm:p-4 backdrop-blur-md">
              {/* Header row */}
              <div className="grid grid-cols-12 px-3 py-2 text-xs font-bold text-[#B3B3B3] border-b border-white/[0.08] mb-1">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-7 sm:col-span-6">Title</div>
                <div className="hidden sm:block sm:col-span-3">Genre</div>
                <div className="col-span-4 sm:col-span-2 text-right flex items-center justify-end gap-1">
                  <Clock3 size={13} />
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-0.5">
                {filteredTracks.map((track, idx) => {
                  const isCurrent = currentTrack?.videoId === track.videoId;
                  const cover = track.covers[0] || "/recommendations/thumbnails/1.jpg";

                  return (
                    <div
                      key={track.videoId}
                      onMouseEnter={() => setHoveredTrackId(track.videoId)}
                      onMouseLeave={() => setHoveredTrackId(null)}
                      onClick={() => {
                        if (isCurrent) togglePlay();
                        else playTrack(track, tracks);
                      }}
                      className={`grid grid-cols-12 items-center px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer group ${
                        isCurrent
                          ? "bg-[#282828] text-[#1DB954]"
                          : "hover:bg-[#282828]/70 text-slate-200"
                      }`}
                    >
                      {/* # Index / Play button toggle */}
                      <div className="col-span-1 flex items-center justify-center text-xs font-semibold text-[#B3B3B3]">
                        {isCurrent ? (
                          isPlaying ? (
                            <Pause size={14} className="fill-[#1DB954] text-[#1DB954]" />
                          ) : (
                            <Play size={14} className="fill-[#1DB954] text-[#1DB954]" />
                          )
                        ) : hoveredTrackId === track.videoId ? (
                          <Play size={14} className="fill-white text-white" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      {/* 1:1 Cover Art + Title + Artist */}
                      <div className="col-span-7 sm:col-span-6 flex items-center gap-3 min-w-0 pr-2">
                        <div className="relative h-11 w-11 aspect-square shrink-0 rounded-md overflow-hidden bg-black shadow">
                          <Image
                            src={cover}
                            alt={track.title}
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-bold text-sm truncate ${
                              isCurrent ? "text-[#1DB954]" : "text-white group-hover:text-white"
                            }`}
                          >
                            {track.title}
                          </p>
                          <p className="text-xs text-[#B3B3B3] truncate">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      {/* Genre */}
                      <div className="hidden sm:block sm:col-span-3 text-xs text-[#B3B3B3] truncate">
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold">
                          {track.genre || "Pop"}
                        </span>
                      </div>

                      {/* Duration & Actions */}
                      <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-3 text-xs font-mono text-[#B3B3B3]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToQueue(track);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-white transition"
                          title="Add to queue"
                        >
                          <ListPlus size={15} />
                        </button>
                        <span>{formatDuration(track.duration)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── 5. SPOTIFY SIGNATURE GENRE BROWSE TILES ───────────────── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <Disc3 size={22} className="text-[#1DB954]" />
              <span>Browse All Categories</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {SPOTIFY_GENRE_CARDS.map((card) => (
              <div
                key={card.id}
                onClick={() => setSelectedGenre(card.id)}
                className={`relative h-32 sm:h-36 rounded-2xl bg-gradient-to-br ${card.color} p-4 overflow-hidden cursor-pointer shadow-md hover:scale-[1.02] transition-transform duration-200 select-none`}
              >
                <span className="text-base sm:text-lg font-black text-white block">
                  {card.name}
                </span>

                {/* Tilted miniature album artwork (Signature Spotify Browse) */}
                <div className="absolute -bottom-2 -right-3 h-16 w-16 sm:h-20 sm:w-20 aspect-square rounded-lg overflow-hidden shadow-2xl rotate-[24deg] translate-x-1 translate-y-1">
                  <Image
                    src={card.iconCover}
                    alt={card.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. TOP ARTISTS SHOWCASE (Circular Avatars) ─────────────── */}
        {topArtists.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <Mic2 size={22} className="text-[#1DB954]" />
              <span>Popular Artists</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topArtists.map((artist) => {
                const isNotified = subscribedArtists.has(artist.id);

                return (
                  <div
                    key={artist.id}
                    className="flex flex-col items-center text-center p-4 rounded-2xl bg-[#181818] hover:bg-[#282828] transition-all duration-200 border border-white/[0.04] group cursor-pointer"
                  >
                    <Link
                      href={
                        artist.username
                          ? `/u/${artist.username}`
                          : `/channel?id=${artist.id}`
                      }
                      className="w-full flex flex-col items-center"
                    >
                      <div className="relative h-24 w-24 aspect-square rounded-full overflow-hidden shadow-xl border-2 border-transparent group-hover:border-[#1DB954] transition-all">
                        <Image
                          src={artist.avatarUrl || "/avatars/avatar.png"}
                          alt={artist.name}
                          fill
                          sizes="96px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <p className="mt-3 font-bold text-sm text-white truncate max-w-[130px]">
                        {artist.name}
                      </p>
                      <p className="text-[11px] text-[#B3B3B3]">Artist</p>
                    </Link>

                    <button
                      onClick={() => toggleArtistNotify(artist.id)}
                      className={`mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold transition cursor-pointer ${
                        isNotified
                          ? "bg-[#1DB954] text-black"
                          : "bg-white/10 hover:bg-white/20 text-white"
                      }`}
                    >
                      {isNotified ? (
                        <>
                          <CheckCircle2 size={12} />
                          <span>Following</span>
                        </>
                      ) : (
                        <span>Follow</span>
                      )}
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
