"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ChevronUp,
  ChevronDown,
  ListMusic,
  Mic2,
  Heart,
  Share2,
  Download,
  Gauge,
  X,
  Music2,
  PlusCircle,
  Check,
} from "lucide-react";
import { useMusicPlayer } from "@/app/context/MusicPlayerContext";
import { recordShare } from "@/app/components/ShareButton";

function formatSeconds(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GlobalMusicPlayer() {
  const pathname = usePathname();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    playbackRate,
    queue,
    queueIndex,
    isExpanded,
    isLyricDrawerOpen,
    isQueueDrawerOpen,
    activeCoverIndex,
    activeLyricIndex,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    setPlaybackRate,
    setExpanded,
    toggleLyricDrawer,
    toggleQueueDrawer,
    removeFromQueue,
    playTrack,
    closePlayer,
  } = useMusicPlayer();

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Sync like state when track changes
  useEffect(() => {
    if (!currentTrack) return;
    setIsLiked(false);
    setLikeCount(
      typeof currentTrack.likeCount === "number"
        ? currentTrack.likeCount
        : parseInt(String(currentTrack.likeCount || "0"), 10) || 0
    );

    // Check user like status
    fetch(`/api/likes?videoId=${currentTrack.videoId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.liked) setIsLiked(true);
        if (typeof data?.count === "number") setLikeCount(data.count);
      })
      .catch(() => {});
  }, [currentTrack?.videoId]);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (!isLyricDrawerOpen || activeLyricIndex < 0) return;
    const container = lyricsContainerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(
      `[data-lyric-index="${activeLyricIndex}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLyricIndex, isLyricDrawerOpen]);

  if (!currentTrack) return null;

  const currentCover =
    currentTrack.covers && currentTrack.covers.length > 0
      ? currentTrack.covers[activeCoverIndex] || currentTrack.covers[0]
      : "/recommendations/thumbnails/1.jpg";

  const handleToggleLike = async () => {
    if (!currentTrack) return;
    const prev = isLiked;
    setIsLiked(!prev);
    setLikeCount((c) => (prev ? Math.max(0, c - 1) : c + 1));

    try {
      await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: currentTrack.videoId }),
      });
    } catch {
      setIsLiked(prev);
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    const url = `${window.location.origin}/music?v=${currentTrack.videoId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: `Listen to "${currentTrack.title}" by ${currentTrack.artist} on InPlayer Music`,
          url,
        });
        recordShare(currentTrack.videoId);
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      recordShare(currentTrack.videoId);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <>
      {/* ── EXPANDED FULLSCREEN IMMERSIVE PLAYER ─────────────────────── */}
      {isExpanded && (
        <div className="fixed inset-0 z-[120] flex flex-col bg-[#050B14]/95 text-white backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200 light:bg-[#FAF6EF]/95 light:text-slate-900 overflow-y-auto">
          {/* Ambient Glow Aura */}
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-transparent blur-[120px]" />

          {/* Top Bar */}
          <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 light:border-black/10 max-w-5xl mx-auto w-full">
            <button
              onClick={() => setExpanded(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 light:bg-black/5 hover:bg-white/15 light:hover:bg-black/15 transition"
              title="Minimize player"
            >
              <ChevronDown size={22} />
            </button>

            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-400">
                Now Playing
              </span>
              <p className="text-sm font-semibold truncate max-w-xs md:max-w-md">
                {currentTrack.title}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 light:bg-black/5 hover:bg-white/15 light:hover:bg-black/15 transition text-slate-300 light:text-slate-700 hover:text-orange-400"
                title="Share track"
              >
                {copiedLink ? <Check size={18} className="text-emerald-400" /> : <Share2 size={18} />}
              </button>
              <a
                href={`/api/videos/${currentTrack.videoId}/download`}
                download
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 light:bg-black/5 hover:bg-white/15 light:hover:bg-black/15 transition text-slate-300 light:text-slate-700 hover:text-orange-400"
                title="Download M4A Audio"
              >
                <Download size={18} />
              </a>
            </div>
          </header>

          {/* Main Body */}
          <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-6 py-6 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-14">
            {/* Left: Album Cover & Visualizer */}
            <div className="flex flex-col items-center max-w-sm w-full">
              <div className="relative group w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 light:border-black/10 bg-black/40">
                <Image
                  src={currentCover}
                  alt={currentTrack.title}
                  fill
                  sizes="(max-width: 768px) 320px, 400px"
                  className={`object-cover transition-transform duration-700 ${
                    isPlaying ? "scale-105" : "scale-100"
                  }`}
                />
                {/* Visualizer overlay */}
                {isPlaying && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-1 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                    <span className="w-1 h-3.5 bg-orange-400 rounded-full animate-pulse" />
                    <span className="w-1 h-5 bg-amber-400 rounded-full animate-pulse [animation-delay:150ms]" />
                    <span className="w-1 h-2.5 bg-orange-500 rounded-full animate-pulse [animation-delay:300ms]" />
                    <span className="w-1 h-4 bg-orange-300 rounded-full animate-pulse [animation-delay:450ms]" />
                    <span className="w-1 h-6 bg-amber-300 rounded-full animate-pulse [animation-delay:200ms]" />
                  </div>
                )}
              </div>

              {/* Title & Artist & Like */}
              <div className="mt-6 flex items-center justify-between w-full">
                <div className="min-w-0 pr-4">
                  <h1 className="text-xl sm:text-2xl font-black truncate tracking-tight">
                    {currentTrack.title}
                  </h1>
                  <p className="text-sm font-semibold text-slate-400 light:text-slate-600 truncate mt-0.5">
                    {currentTrack.artist}
                  </p>
                  {currentTrack.genre && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20">
                      {currentTrack.genre}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleToggleLike}
                  className={`flex flex-col items-center justify-center p-2 transition-transform active:scale-90 ${
                    isLiked
                      ? "text-rose-500"
                      : "text-slate-400 light:text-slate-600 hover:text-rose-400"
                  }`}
                  title="Like track"
                >
                  <Heart
                    size={26}
                    className={isLiked ? "fill-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]" : ""}
                  />
                  <span className="text-[10px] font-bold mt-0.5">{likeCount}</span>
                </button>
              </div>
            </div>

            {/* Right: Controls & Lyrics / Queue */}
            <div className="flex-1 w-full max-w-md flex flex-col justify-center">
              {/* Progress Slider */}
              <div className="w-full">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/20 light:bg-black/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs font-mono text-slate-400 light:text-slate-600 mt-1.5">
                  <span>{formatSeconds(currentTime)}</span>
                  <span>{formatSeconds(duration)}</span>
                </div>
              </div>

              {/* Main Transport Controls */}
              <div className="mt-6 flex items-center justify-between px-2">
                <button
                  onClick={toggleShuffle}
                  className={`p-2 rounded-full transition ${
                    isShuffled
                      ? "text-orange-400 bg-orange-500/10"
                      : "text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900"
                  }`}
                  title="Shuffle"
                >
                  <Shuffle size={20} />
                </button>

                <button
                  onClick={prevTrack}
                  className="p-3 rounded-full text-slate-300 light:text-slate-700 hover:text-white light:hover:text-slate-900 transition hover:scale-110 active:scale-95"
                  title="Previous"
                >
                  <SkipBack size={26} />
                </button>

                <button
                  onClick={togglePlay}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-[0_0_30px_rgba(249,115,22,0.5)] transition hover:scale-105 active:scale-95"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={30} className="fill-white" /> : <Play size={30} className="fill-white translate-x-0.5" />}
                </button>

                <button
                  onClick={nextTrack}
                  className="p-3 rounded-full text-slate-300 light:text-slate-700 hover:text-white light:hover:text-slate-900 transition hover:scale-110 active:scale-95"
                  title="Next"
                >
                  <SkipForward size={26} />
                </button>

                <button
                  onClick={toggleRepeat}
                  className={`p-2 rounded-full transition ${
                    repeatMode !== "off"
                      ? "text-orange-400 bg-orange-500/10"
                      : "text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900"
                  }`}
                  title={`Repeat: ${repeatMode}`}
                >
                  {repeatMode === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}
                </button>
              </div>

              {/* Extra Utility Row (Volume, Speed, Lyrics, Queue) */}
              <div className="mt-8 flex items-center justify-between border-t border-white/10 light:border-black/10 pt-5">
                {/* Volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white light:hover:text-slate-900 transition"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-20 h-1 bg-white/20 light:bg-black/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>

                {/* Speed Selector */}
                <div className="relative">
                  <button
                    onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 light:bg-black/5 text-xs font-semibold text-slate-300 light:text-slate-700 hover:bg-white/10 light:hover:bg-black/10 transition"
                  >
                    <Gauge size={13} />
                    <span>{playbackRate}x</span>
                  </button>
                  {speedMenuOpen && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 mb-2 rounded-xl bg-[#111c2e] light:bg-white border border-white/10 light:border-black/10 shadow-2xl p-1 z-30 flex flex-col gap-1 min-w-[70px]">
                      {speeds.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setPlaybackRate(s);
                            setSpeedMenuOpen(false);
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg text-center transition ${
                            playbackRate === s
                              ? "bg-orange-500 text-white"
                              : "text-slate-300 light:text-slate-700 hover:bg-white/10 light:hover:bg-black/10"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lyrics Drawer Toggle */}
                <button
                  onClick={toggleLyricDrawer}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    isLyricDrawerOpen
                      ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                      : "bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-700 hover:bg-white/10 light:hover:bg-black/10"
                  }`}
                >
                  <Mic2 size={14} />
                  <span>Lyrics</span>
                </button>

                {/* Queue Drawer Toggle */}
                <button
                  onClick={toggleQueueDrawer}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    isQueueDrawerOpen
                      ? "bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                      : "bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-700 hover:bg-white/10 light:hover:bg-black/10"
                  }`}
                >
                  <ListMusic size={14} />
                  <span>Queue ({queue.length})</span>
                </button>
              </div>

              {/* Synced Lyrics Pane */}
              {isLyricDrawerOpen && (
                <div className="mt-6 rounded-2xl bg-black/30 light:bg-black/5 border border-white/10 light:border-black/10 p-4 h-64 overflow-y-auto custom-scrollbar">
                  <div ref={lyricsContainerRef} className="space-y-4 text-center py-8">
                    {currentTrack.lyrics && currentTrack.lyrics.length > 0 ? (
                      currentTrack.lyrics.map((line, idx) => {
                        const isActive = idx === activeLyricIndex;
                        return (
                          <p
                            key={idx}
                            data-lyric-index={idx}
                            onClick={() => seek(line.time ?? (line as any).seconds ?? 0)}
                            className={`cursor-pointer transition-all duration-300 font-bold ${
                              isActive
                                ? "text-xl sm:text-2xl text-orange-400 scale-105 drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]"
                                : "text-sm sm:text-base text-slate-500 hover:text-slate-300 light:hover:text-slate-700"
                            }`}
                          >
                            {line.text}
                          </p>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400 py-12">
                        No synchronized lyrics available for this track.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Queue Drawer Pane */}
              {isQueueDrawerOpen && (
                <div className="mt-6 rounded-2xl bg-black/30 light:bg-black/5 border border-white/10 light:border-black/10 p-4 max-h-64 overflow-y-auto custom-scrollbar">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Up Next ({queue.length})
                  </p>
                  <div className="space-y-2">
                    {queue.map((item, idx) => (
                      <div
                        key={`${item.videoId}-${idx}`}
                        className={`flex items-center justify-between gap-3 p-2 rounded-xl transition ${
                          idx === queueIndex
                            ? "bg-orange-500/20 border border-orange-500/40 text-orange-300"
                            : "hover:bg-white/5 light:hover:bg-black/5 text-slate-300 light:text-slate-700"
                        }`}
                      >
                        <button
                          onClick={() => playTrack(item)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                        >
                          <span className="text-xs font-mono opacity-60 w-4">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {item.artist}
                            </p>
                          </div>
                        </button>
                        {queue.length > 1 && (
                          <button
                            onClick={() => removeFromQueue(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ── DOCKED BOTTOM BAR (Spotify-beating compact bar) ──────────── */}
      <div
        className={`fixed z-[90] transition-all duration-300 left-0 right-0 ${
          // On mobile, dock above the bottom navbar; on desktop, dock at the bottom edge
          "bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:bottom-0"
        } px-2 sm:px-4 pb-2`}
      >
        <div className="max-w-7xl mx-auto rounded-2xl border border-white/15 light:border-black/15 bg-[#060F1E]/90 light:bg-[#FAF6EF]/90 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] px-3 sm:px-5 py-2.5 flex items-center justify-between gap-3">
          {/* Left: Cover & Info */}
          <div
            onClick={() => setExpanded(true)}
            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
          >
            <div className="relative h-11 w-11 sm:h-13 sm:w-13 shrink-0 rounded-xl overflow-hidden shadow-md border border-white/10 bg-black">
              <Image
                src={currentCover}
                alt={currentTrack.title}
                fill
                sizes="52px"
                className="object-cover group-hover:scale-105 transition-transform"
              />
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-ping" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-white light:text-slate-900 truncate group-hover:text-orange-400 transition">
                {currentTrack.title}
              </p>
              <p className="text-[11px] font-medium text-slate-400 light:text-slate-600 truncate">
                {currentTrack.artist}
              </p>
            </div>
          </div>

          {/* Center: Transport Controls (Desktop / Tablet) */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={prevTrack}
                className="hidden sm:flex text-slate-400 hover:text-white light:hover:text-slate-900 transition"
                title="Previous"
              >
                <SkipBack size={18} />
              </button>

              <button
                onClick={togglePlay}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)] transition hover:scale-105 active:scale-95"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white translate-x-0.5" />}
              </button>

              <button
                onClick={nextTrack}
                className="hidden sm:flex text-slate-400 hover:text-white light:hover:text-slate-900 transition"
                title="Next"
              >
                <SkipForward size={18} />
              </button>
            </div>
          </div>

          {/* Right: Actions & Expand */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={handleToggleLike}
              className={`p-2 rounded-full transition ${
                isLiked
                  ? "text-rose-500"
                  : "text-slate-400 hover:text-rose-400"
              }`}
              title="Like"
            >
              <Heart size={18} className={isLiked ? "fill-rose-500" : ""} />
            </button>

            <button
              onClick={() => setExpanded(true)}
              className="p-2 rounded-full text-slate-400 hover:text-orange-400 transition"
              title="Open full player"
            >
              <ChevronUp size={20} />
            </button>

            <button
              onClick={closePlayer}
              className="p-2 rounded-full text-slate-400 hover:text-rose-400 transition"
              title="Close player"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
