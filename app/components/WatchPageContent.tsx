"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Maximize2, Minimize2 } from "lucide-react";
import VideoPlayer from "@/app/components/VideoPlayer";
import SubscribeButton from "@/app/components/SubscribeButton";
import LikeButton from "@/app/components/LikeButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
import ShareButton from "@/app/components/ShareButton";
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
  uploadedAt: string;
  views: number;
  muxPlaybackId: string;
  thumbnailUrl?: string;
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
          thumbnail sitting behind everything, like Apple Music's Now
          Playing background. Purely atmospheric, never affects layout. */}
      {video.thumbnailUrl && (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0 scale-110 animate-ambient-pulse"
            style={{
              backgroundImage: `url(${video.thumbnailUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(90px) saturate(1.3)",
              opacity: 0.35,
            }}
          />
          <div className="absolute inset-0 bg-[#050816]/85 light:bg-white/90" />
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-8 transition-all duration-500 ${
          theaterMode
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[minmax(0,1fr)_380px]"
        }`}
      >
        {/* Left column — player + info */}
        <div className="min-w-0">
          <div className="group relative">
            <div
              className={`overflow-hidden rounded-2xl shadow-[0_0_60px_rgba(249,115,22,.08)] transition-all duration-500 ${
                theaterMode ? "mx-auto max-w-[1100px]" : ""
              }`}
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
                absolute right-3 top-3 z-10
                flex h-9 w-9 items-center justify-center rounded-full
                bg-black/50 text-white backdrop-blur-md
                opacity-0 transition-all duration-300
                hover:bg-black/70 group-hover:opacity-100
              "
            >
              {theaterMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          <div className={theaterMode ? "mx-auto max-w-[1100px]" : ""}>
            <h1
              className="animate-fade-in-up mt-4 text-xl sm:text-2xl font-black leading-tight text-white light:text-slate-900"
              style={{ animationDelay: "50ms" }}
            >
              {video.title}
            </h1>

            <p
              className="animate-fade-in-up mt-1.5 text-sm text-slate-400 light:text-slate-500"
              style={{ animationDelay: "100ms" }}
            >
              <AnimatedCounter value={video.views || 0} format={formatViews} />
              {" • "}
              {formatTimeAgo(video.uploadedAt)}
            </p>

            <div
              className="animate-fade-in-up mt-4 flex flex-wrap items-center justify-between gap-4 border-y border-white/10 light:border-black/10 py-4"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-white/10 light:border-black/10">
                  <Image
                    src="/avatars/avatar.png"
                    alt={video.uploaderName}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                </div>

                <p className="font-semibold text-white light:text-slate-900">
                  {video.uploaderName}
                </p>

                <SubscribeButton creatorId={video.uploaderId} />
              </div>

              <div className="flex items-center gap-2">
                <LikeButton videoId={video.videoId} />
                <WatchLaterButton videoId={video.videoId} />
                <ShareButton videoId={video.videoId} title={video.title} />

                <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 light:text-orange-700">
                  {video.category}
                </span>
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
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400 light:text-slate-500">
              Up Next
            </h2>

            <div className="space-y-1">
              {relatedVideos.length === 0 ? (
                <p className="text-sm text-slate-500">No other videos yet.</p>
              ) : (
                relatedVideos.map((related, i) => (
                  <Link
                    key={related.videoId}
                    href={`/watch/${related.videoId}`}
                    className="animate-fade-in-up group flex gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-white/5 light:hover:bg-black/5"
                    style={{ animationDelay: `${200 + i * 40}ms` }}
                  >
                    <div className="relative h-[80px] w-[140px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">
                      {related.thumbnailUrl && (
                        <Image
                          src={related.thumbnailUrl}
                          alt={related.title}
                          fill
                          sizes="140px"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
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
