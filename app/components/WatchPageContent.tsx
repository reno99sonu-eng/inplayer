"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Maximize2, Minimize2, Eye, Calendar, Tag } from "lucide-react";
import VideoPlayer from "@/app/components/VideoPlayer";
import SubscribeButton from "@/app/components/SubscribeButton";
import LikeButton from "@/app/components/LikeButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
import ShareButton from "@/app/components/ShareButton";
import DownloadButton from "@/app/components/DownloadButton";
import DescriptionBox from "@/app/components/DescriptionBox";
import CommentSection from "@/app/components/CommentSection";
import AnimatedCounter from "@/app/components/AnimatedCounter";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";

interface VideoData {
  videoId: string;
  title: string;
  description?: string;
  category: string;
  uploaderId: string;
  uploaderName: string;
  uploaderAvatarUrl?: string;
  uploadedAt: string;
  views: number;
  muxPlaybackId: string;
  thumbnailUrl?: string;
  contentType?: string;
  downloadStatus?: "unavailable" | "preparing" | "ready" | "errored";
}

interface RelatedVideo {
  videoId: string;
  title: string;
  uploaderName: string;
  views: number;
  uploadedAt: string;
  thumbnailUrl?: string;
}

interface WatchPageContentProps {
  video: VideoData;
  relatedVideos: RelatedVideo[];
}

export default function WatchPageContent({
  video,
  relatedVideos,
}: WatchPageContentProps) {
  const [theaterMode, setTheaterMode] = useState(false);

  return (
    <div className="relative">
      {/* Ambient cinematic glow — a heavily blurred wash of the video's own
          thumbnail sitting behind everything, layered with a soft orange
          wash for extra richness. Purely atmospheric, never affects layout. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {video.thumbnailUrl && (
          <div
            className="absolute inset-0 scale-110 animate-ambient-pulse"
            style={{
              backgroundImage: `url(${video.thumbnailUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(100px) saturate(1.5)",
              opacity: 0.4,
            }}
          />
        )}
        <div className="absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[160px]" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-amber-400/10 blur-[160px]" />
        <div className="absolute inset-0 bg-[#050816]/88 light:bg-white/92" />
      </div>

      <div
        className={`grid grid-cols-1 gap-5 lg:gap-8 transition-all duration-500 ${
          theaterMode
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[minmax(0,1fr)_380px]"
        }`}
      >
        {/* Left column — player + info */}
        <div className="min-w-0">
          <div className="group relative">
            <div
              className={`
                overflow-hidden rounded-3xl
                ring-1 ring-white/10 light:ring-black/10
                transition-all duration-500
                ${theaterMode ? "mx-auto max-w-[1100px]" : ""}
              `}
            >
              <VideoPlayer
                playbackId={video.muxPlaybackId}
                title={video.title}
                videoId={video.videoId}
              />
            </div>

            <button
              onClick={() => setTheaterMode(!theaterMode)}
              title={theaterMode ? "Exit theater mode" : "Theater mode"}
              className="
                theater-toggle-btn
                absolute right-3 top-3 z-10
                flex h-9 w-9 items-center justify-center rounded-full
                border border-white/10 bg-black/60 text-white backdrop-blur-md
                opacity-0 transition-all duration-300
                hover:scale-110 hover:border-orange-400/40 hover:bg-black/80
                group-hover:opacity-100

                lg:right-4 lg:top-4 lg:h-10 lg:w-10
              "
            >
              {theaterMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>

          <div className={theaterMode ? "mx-auto max-w-[1100px]" : ""}>
            <h1
              className="animate-fade-in-up mt-3 lg:mt-4 bg-gradient-to-r from-white to-white/70 light:from-slate-900 light:to-slate-900/70 bg-clip-text text-lg lg:text-xl font-bold leading-[1.2] tracking-tight text-transparent"
              style={{ animationDelay: "50ms" }}
            >
              {video.title}
            </h1>

            <div
              className="animate-fade-in-up mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400 light:text-slate-500 lg:mt-3 lg:gap-x-4 lg:gap-y-1.5"
              style={{ animationDelay: "100ms" }}
            >
              <span className="flex items-center gap-1.5">
                <Eye size={14} className="text-orange-400" />
                <AnimatedCounter value={video.views || 0} format={formatViews} />
              </span>

              <span className="h-1 w-1 rounded-full bg-slate-600" />

              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-orange-400" />
                {formatTimeAgo(video.uploadedAt)}
              </span>

              <span className="h-1 w-1 rounded-full bg-slate-600" />

              <span className="flex items-center gap-1.5">
                <Tag size={14} className="text-orange-400" />
                {video.category}
              </span>
            </div>

            {/* Glass card — channel identity + actions */}
            <div
              className="
                animate-fade-in-up mt-4 rounded-3xl border border-white/[0.08] light:border-black/[0.08]
                bg-gradient-to-br from-white/[0.05] to-white/[0.01] light:from-black/[0.03] light:to-transparent
                p-3 backdrop-blur-xl
                shadow-[0_25px_70px_-25px_rgba(0,0,0,.4)]

                lg:mt-4
              "
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 lg:gap-4">
                <div className="flex items-center gap-2.5 lg:gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="absolute -inset-[2px] rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-orange-500 opacity-80 blur-[3px]" />
                    <div className="relative h-9 w-9 overflow-hidden rounded-full ring-2 ring-[#050816] light:ring-white">
                      {/* A plain <img>, not next/image — avatars are
                          base64 data URLs (see app/lib/imageCompress.ts),
                          which next/image doesn't optimize/serve cleanly. */}
                      <img
                        src={video.uploaderAvatarUrl || "/avatars/avatar.png"}
                        alt={video.uploaderName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="font-bold leading-tight text-white light:text-slate-900">
                      {video.uploaderName}
                    </p>
                    <p className="text-xs text-slate-400 light:text-slate-500">
                      Creator
                    </p>
                  </div>

                  <SubscribeButton creatorId={video.uploaderId} />
                </div>

                <div className="flex items-center gap-1.5 lg:gap-2">
                  <LikeButton videoId={video.videoId} />
                  <WatchLaterButton videoId={video.videoId} />
                  <ShareButton videoId={video.videoId} title={video.title} />
                  {/* Videos only — Shorts never get a Download button
                      (see ShortsPageContent.tsx, which doesn't render
                      this component at all). */}
                  {video.contentType !== "short" && (
                    <DownloadButton
                      videoId={video.videoId}
                      initialStatus={video.downloadStatus || "unavailable"}
                    />
                  )}
                </div>
              </div>
            </div>

            {video.description && (
              <div
                className="animate-fade-in-up"
                style={{ animationDelay: "200ms" }}
              >
                <DescriptionBox description={video.description} />
              </div>
            )}

            <div
              className="animate-fade-in-up"
              style={{ animationDelay: "250ms" }}
            >
              <CommentSection videoId={video.videoId} />
            </div>
          </div>
        </div>

        {/* Right column — related videos (hidden in theater mode) */}
        {!theaterMode && (
          <div className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 light:text-slate-500 lg:mb-3">
              <span className="h-4 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-300" />
              Up Next
            </h2>

            <div className="space-y-1.5 lg:space-y-2">
              {relatedVideos.length === 0 ? (
                <p className="text-sm text-slate-500">No other videos yet.</p>
              ) : (
                relatedVideos.map((related, i) => (
                  <Link
                    key={related.videoId}
                    href={`/watch/${related.videoId}`}
                    className="
                      animate-fade-in-up group flex gap-2.5 rounded-2xl
                      border border-transparent p-1.5
                      transition-all duration-300
                      hover:-translate-y-0.5 hover:border-white/[0.08] light:hover:border-black/[0.08]
                      hover:bg-white/[0.04] light:hover:bg-black/[0.03]
                      hover:shadow-[0_15px_40px_-20px_rgba(249,115,22,.25)]

                      lg:gap-3 lg:p-2
                    "
                    style={{ animationDelay: `${200 + i * 40}ms` }}
                  >
                    <div className="relative h-[64px] w-[112px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5 lg:h-[80px] lg:w-[140px]">
                      {related.thumbnailUrl && (
                        <Image
                          src={related.thumbnailUrl}
                          alt={related.title}
                          fill
                          sizes="140px"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold text-white light:text-slate-900 group-hover:text-orange-300 light:group-hover:text-orange-600 transition-colors">
                        {related.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
                        {related.uploaderName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatViews(related.views || 0)} •{" "}
                        {formatTimeAgo(related.uploadedAt)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
