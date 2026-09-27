"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { MuxCSSProperties, MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { Play, Pause, Maximize2, Volume2, VolumeX, X } from "lucide-react";
import { useMiniPlayer } from "@/app/context/MiniPlayerContext";
import { usePathname } from "next/navigation";

const MiniMuxPlayer = dynamic(() => import("@mux/mux-player-react"), { ssr: false });

export default function MiniPlayer() {
  const { miniVideo, isOpen, isPlaying, expandVideo, closeMiniPlayer, togglePlay } =
    useMiniPlayer();
  const pathname = usePathname();
  const playerRef = useRef<MuxPlayerRefAttributes>(null);
  const [isMuted, setIsMuted] = useState(false);

  const isOnSameVideoWatchPage =
    miniVideo &&
    (pathname === `/watch/${miniVideo.videoId}` ||
      pathname.startsWith(`/watch/${miniVideo.videoId}/`));

  useEffect(() => {
    if (isOnSameVideoWatchPage && isOpen) closeMiniPlayer();
  }, [isOnSameVideoWatchPage, isOpen, closeMiniPlayer]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !miniVideo?.muxPlaybackId) return;
    if (!isPlaying) {
      player.pause();
      return;
    }
    void player.play().catch(() => {
      // Mux's `autoPlay="any"` also retries muted when the browser blocks
      // starting with sound. The custom play button remains available.
    });
  }, [isPlaying, miniVideo?.videoId, miniVideo?.muxPlaybackId]);

  if (!isOpen || !miniVideo || isOnSameVideoWatchPage) return null;

  const aspectRatio =
    Number.isFinite(miniVideo.contentAspectRatio) && miniVideo.contentAspectRatio! > 0
      ? miniVideo.contentAspectRatio!
      : miniVideo.isShort
        ? 9 / 16
        : 16 / 9;
  const isPortrait = aspectRatio < 1;
  const expandAtCurrentTime = () =>
    expandVideo(playerRef.current?.currentTime ?? miniVideo.currentTime);

  return (
    <div className="fixed bottom-20 right-3 lg:bottom-6 lg:right-6 z-[105] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={`group relative flex ${isPortrait ? "w-44 sm:w-52" : "w-72 sm:w-80"} flex-col overflow-hidden rounded-2xl border border-white/20 light:border-black/20 bg-[#06101E]/95 light:bg-[#FAF6EF]/95 shadow-[0_12px_45px_rgba(0,0,0,0.6)] backdrop-blur-2xl`}>
        <div
          onClick={() => expandAtCurrentTime()}
          className="relative w-full cursor-pointer overflow-hidden bg-black"
          style={{ aspectRatio: String(aspectRatio) }}
        >
          <Image
            src={miniVideo.thumbnailUrl || "/recommendations/thumbnails/1.jpg"}
            alt={miniVideo.title}
            fill
            sizes="208px"
            className={`object-cover transition duration-300 ${miniVideo.muxPlaybackId ? "opacity-60" : "group-hover:scale-105"}`}
          />

          {miniVideo.muxPlaybackId && (
            <MiniMuxPlayer
              ref={playerRef}
              playbackId={miniVideo.muxPlaybackId}
              tokens={
                miniVideo.playbackToken
                  ? { playback: miniVideo.playbackToken }
                  : undefined
              }
              videoTitle={miniVideo.title}
              aria-label={`Mini player: ${miniVideo.title}`}
              autoPlay={isPlaying ? "any" : false}
              playsInline
              muted={isMuted}
              onVolumeChange={() => {
                setIsMuted(Boolean(playerRef.current?.muted));
              }}
              onLoadedMetadata={() => {
                const player = playerRef.current;
                if (!player) return;
                const startAt = miniVideo.currentTime ?? 0;
                if (startAt > 0 && Number.isFinite(startAt)) {
                  try {
                    player.currentTime = startAt;
                  } catch {
                    // A stream can reject a seek before its first segment is ready.
                  }
                }
                if (!isPlaying) player.pause();
              }}
              className="absolute inset-0 h-full w-full"
              style={
                {
                  width: "100%",
                  height: "100%",
                  "--controls": "none",
                  "--media-object-fit": miniVideo.cropToContent ? "cover" : "contain",
                } as MuxCSSProperties
              }
            />
          )}

          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/75 via-transparent to-black/35" />

          <div className="absolute top-1 left-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                expandAtCurrentTime();
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full text-white drop-shadow-md hover:bg-black/50"
              aria-label="Expand video"
              title="Expand video"
            >
              <Maximize2 size={18} />
            </button>
            {isPortrait && (
              <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow">
                Short
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeMiniPlayer();
            }}
            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-white drop-shadow-md hover:bg-rose-500/80"
            aria-label="Close mini player"
            title="Close mini player"
          >
            <X size={18} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              togglePlay();
            }}
            className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/65 text-white shadow-lg backdrop-blur"
            aria-label={isPlaying ? "Pause mini player" : "Play mini player"}
          >
            {isPlaying ? (
              <Pause size={20} className="fill-white" />
            ) : (
              <Play size={20} className="ml-0.5 fill-white" />
            )}
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2 px-2 py-2.5">
          <button onClick={() => expandAtCurrentTime()} className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-bold text-white light:text-slate-900">
              {miniVideo.title}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-400 light:text-slate-600">
              {miniVideo.creator}
            </p>
          </button>
          {miniVideo.muxPlaybackId && (
            <button
              type="button"
              onClick={() => {
                const player = playerRef.current;
                const nextMuted = !(player?.muted ?? isMuted);
                setIsMuted(nextMuted);
                if (player) player.muted = nextMuted;
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white light:text-slate-900 hover:bg-white/10"
              aria-label={isMuted ? "Unmute mini player" : "Mute mini player"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
