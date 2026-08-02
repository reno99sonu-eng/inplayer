import Link from "next/link";
import Image from "next/image";
import { Calendar, Eye, Play, Radio } from "lucide-react";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";

export interface ChannelVideo {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  views: number;
  uploadedAt: string;
  contentType: string;
  muxPlaybackId?: string;
}

interface ChannelVideoCardProps {
  video: ChannelVideo;
  rank?: number;
  compact?: boolean;
}

export default function ChannelVideoCard({
  video,
  rank,
  compact = false,
}: ChannelVideoCardProps) {
  return (
    <Link
      href={`/watch/${video.videoId}`}
      className="group rounded-3xl border border-white/[0.08] bg-white/[0.025] p-2.5 transition duration-300 hover:-translate-y-1 hover:border-orange-400/35 hover:bg-white/[0.05] hover:shadow-[0_20px_45px_-25px_rgba(249,115,22,.6)] light:border-black/[0.08] light:bg-black/[0.02]"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-white/5 light:bg-black/5 ${compact && video.contentType === "short" ? "aspect-[9/13]" : "aspect-video"}`}>
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            sizes="(max-width: 520px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-500/20 to-slate-900">
            <Play className="text-white/70" />
          </div>
        )}
        {rank && (
          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-orange-300 backdrop-blur">
            #{rank} most viewed
          </span>
        )}
        {video.contentType === "live" && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white">
            <Radio size={10} /> LIVE
          </span>
        )}
      </div>
      <div className="px-1 pb-1 pt-3">
        <h3 className="line-clamp-2 text-sm font-bold text-white transition group-hover:text-orange-300 light:text-slate-900">
          {video.title}
        </h3>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 light:text-slate-600">
          <Eye size={13} className="text-orange-400" />
          {formatViews(video.views || 0)}
          <span>•</span>
          <Calendar size={12} />
          {formatTimeAgo(video.uploadedAt)}
        </div>
      </div>
    </Link>
  );
}
