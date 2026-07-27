"use client";

import Link from "next/link";
import { Play, Share2 } from "lucide-react";
import SubscribeButton from "@/app/components/SubscribeButton";
import WatchLaterButton from "@/app/components/WatchLaterButton";
import ShareButton from "@/app/components/ShareButton";
import WatchMeta from "./WatchMeta";

interface WatchHeroProps {
  video: {
    videoId: string;
    title: string;
    description?: string;
    category: string;
    uploaderId: string;
    uploaderName: string;
    uploaderUsername?: string;
    uploaderAvatarUrl?: string;
    uploadedAt: string;
    views: number;
    thumbnailUrl?: string;
    tags?: string[];
    ageRestricted?: boolean;
  };
}

export default function WatchHero({ video }: WatchHeroProps) {
  const profileHref = video.uploaderUsername
    ? `/u/${encodeURIComponent(video.uploaderUsername)}`
    : null;
  const scrollToPlayer = () => document.getElementById("watch-player")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <section className="relative isolate min-h-[510px] overflow-hidden rounded-[30px] border border-white/10 bg-[#050816] shadow-[0_30px_90px_rgba(0,0,0,.45)] light:border-black/10">
      {video.thumbnailUrl && <div className="absolute inset-0 scale-105 bg-cover bg-center opacity-70" style={{ backgroundImage: `url(${video.thumbnailUrl})` }} />}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/88 to-[#050816]/25 light:from-[#f4ecda] light:via-[#f4ecda]/85 light:to-[#f4ecda]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-black/35 light:from-[#f4ecda]" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-orange-500/20 blur-[110px]" />

      <div className="relative flex min-h-[510px] max-w-4xl flex-col justify-end px-5 pb-7 pt-28 sm:px-9 sm:pb-10 lg:px-12 lg:pb-12">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.25em] text-orange-300">Now streaming</p>
        <h1 className="max-w-3xl text-3xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl light:text-slate-900">{video.title}</h1>
        <div className="mt-4"><WatchMeta views={video.views} uploadedAt={video.uploadedAt} category={video.category} ageRestricted={video.ageRestricted} /></div>

        <div className="mt-5 flex items-center gap-3">
          {profileHref ? (
            <Link href={profileHref} className="flex-shrink-0 transition-transform hover:scale-105">
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-orange-400/70">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploader avatars can be data URLs. */}
                <img src={video.uploaderAvatarUrl || "/avatars/avatar.png"} alt={video.uploaderName} className="h-full w-full object-cover" />
              </div>
            </Link>
          ) : (
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-orange-400/70">
              <img src={video.uploaderAvatarUrl || "/avatars/avatar.png"} alt={video.uploaderName} className="h-full w-full object-cover" />
            </div>
          )}
          <div>
            {profileHref ? <Link href={profileHref} className="font-bold text-white transition hover:text-orange-300 light:text-slate-900">{video.uploaderName}</Link> : <p className="font-bold text-white light:text-slate-900">{video.uploaderName}</p>}
            {video.uploaderUsername && <p className="text-xs text-slate-400">@{video.uploaderUsername}</p>}
          </div>
          <div className="hidden sm:block"><SubscribeButton creatorId={video.uploaderId} /></div>
        </div>

        <p className="mt-5 line-clamp-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-200 light:text-slate-700">{video.description?.trim() || "No description provided."}</p>
        {video.tags && video.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{video.tags.map((tag) => <span key={tag} className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-200 backdrop-blur-sm light:border-black/10 light:bg-white/40 light:text-slate-700">#{tag}</span>)}</div>}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button onClick={scrollToPlayer} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff7315] via-[#ff9a00] to-[#ffc83d] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(249,115,22,.35)] transition hover:-translate-y-0.5"><Play size={17} fill="currentColor" /> Watch now</button>
          <WatchLaterButton videoId={video.videoId} />
          <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-2.5 py-1.5 text-xs text-slate-300 backdrop-blur sm:hidden"><Share2 size={13} /> <ShareButton videoId={video.videoId} title={video.title} /></span>
          <div className="hidden sm:block"><ShareButton videoId={video.videoId} title={video.title} /></div>
          <div className="sm:hidden"><SubscribeButton creatorId={video.uploaderId} /></div>
        </div>
      </div>
    </section>
  );
}
