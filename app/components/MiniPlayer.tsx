"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, Maximize2, X } from "lucide-react";
import { useMiniPlayer } from "@/app/context/MiniPlayerContext";
import { usePathname } from "next/navigation";

export default function MiniPlayer() {
  const { miniVideo, isOpen, isPlaying, expandVideo, closeMiniPlayer, togglePlay } =
    useMiniPlayer();
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);

  // If the user navigates directly onto the watch page of the same video, hide the miniplayer
  const isOnSameVideoWatchPage =
    miniVideo &&
    (pathname === `/watch/${miniVideo.videoId}` ||
      pathname.startsWith(`/watch/${miniVideo.videoId}/`));

  useEffect(() => {
    if (isOnSameVideoWatchPage && isOpen) {
      closeMiniPlayer();
    }
  }, [isOnSameVideoWatchPage, isOpen, closeMiniPlayer]);

  if (!isOpen || !miniVideo || isOnSameVideoWatchPage) return null;

  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[105] animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="group relative flex w-72 sm:w-80 flex-col overflow-hidden rounded-2xl border border-white/20 light:border-black/20 bg-[#06101E]/95 light:bg-[#FAF6EF]/95 shadow-[0_12px_45px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {/* Thumbnail / Video Viewport */}
        <div
          onClick={expandVideo}
          className="relative aspect-video w-full cursor-pointer bg-black overflow-hidden"
        >
          <Image
            src={miniVideo.thumbnailUrl || "/recommendations/thumbnails/1.jpg"}
            alt={miniVideo.title}
            fill
            sizes="320px"
            className="object-cover group-hover:scale-105 transition duration-300"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Expand Badge Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg">
              <Maximize2 size={18} />
            </div>
          </div>

          {/* Close & Expand top buttons */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMiniPlayer();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-rose-500 transition"
              title="Close mini player"
            >
              <X size={14} />
            </button>
          </div>

          {miniVideo.isShort && (
            <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-orange-500 text-white shadow">
              Raftaar
            </span>
          )}
        </div>

        {/* Info & Bottom Bar */}
        <div className="flex items-center justify-between p-3 gap-2">
          <div
            onClick={expandVideo}
            className="min-w-0 flex-1 cursor-pointer"
          >
            <p className="text-xs font-bold text-white light:text-slate-900 truncate group-hover:text-orange-400 transition">
              {miniVideo.title}
            </p>
            <p className="text-[11px] font-medium text-slate-400 light:text-slate-600 truncate">
              {miniVideo.creator}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={togglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white shadow transition hover:scale-105 active:scale-95"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={14} className="fill-white" /> : <Play size={14} className="fill-white translate-x-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
