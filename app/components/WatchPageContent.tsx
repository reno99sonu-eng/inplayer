"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import { Maximize2, MessageSquareOff, Minimize2, ShieldAlert } from "lucide-react";
import VideoPlayer from "@/app/components/VideoPlayer";
import CommentSection from "@/app/components/CommentSection";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import WatchActions from "@/app/components/watch/WatchActions";
import WatchHero from "@/app/components/watch/WatchHero";

interface VideoData {
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
  muxPlaybackId: string;
  thumbnailUrl?: string;
  contentType?: string;
  downloadStatus?: "unavailable" | "preparing" | "ready" | "errored";
  downloadRenditions?: Record<string, string>;
  tags?: string[];
  commentsEnabled?: boolean;
  ageRestricted?: boolean;
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

export default function WatchPageContent({ video, relatedVideos: initialRelatedVideos }: WatchPageContentProps) {
  const { signedIn } = useAuthModal();
  const [theaterMode, setTheaterMode] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState(initialRelatedVideos);
  const commentsOn = video.commentsEnabled !== false;
  const showPlayer = !video.ageRestricted || ageConfirmed;

  useEffect(() => {
    let cancelled = false;
    async function loadPersonalized() {
      try {
        let headers: HeadersInit = {};
        if (signedIn) {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          if (idToken) headers = { Authorization: `Bearer ${idToken}` };
        }
        const res = await fetch(`/api/videos/related?excludeVideoId=${encodeURIComponent(video.videoId)}&category=${encodeURIComponent(video.category)}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.videos) && data.videos.length > 0) setRelatedVideos(data.videos);
      } catch (err) {
        console.error("Failed to load personalized related videos:", err);
      }
    }
    void loadPersonalized();
    return () => { cancelled = true; };
  }, [video.videoId, video.category, signedIn]);

  return (
    <div className="relative space-y-6 lg:space-y-8">
      <WatchHero video={video} />

      <div className={`grid grid-cols-1 gap-6 transition-all duration-500 ${theaterMode ? "" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
        <div className="min-w-0">
          <div id="watch-player" className="group relative scroll-mt-5">
            <div className={`overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_25px_70px_rgba(0,0,0,.4)] light:border-black/10 ${theaterMode ? "mx-auto max-w-[1300px]" : ""}`}>
              {showPlayer ? <VideoPlayer playbackId={video.muxPlaybackId} title={video.title} videoId={video.videoId} /> : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400"><ShieldAlert size={26} /></div>
                  <div><p className="text-base font-bold text-white">Age-restricted video</p><p className="mt-1 max-w-sm text-sm text-slate-400">This video is intended for viewers 18 and older.</p></div>
                  <button onClick={() => setAgeConfirmed(true)} className="rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition hover:-translate-y-0.5">I&apos;m 18 or older — continue</button>
                </div>
              )}
            </div>
            <button onClick={() => setTheaterMode((active) => !active)} title={theaterMode ? "Exit theater mode" : "Theater mode"} className="absolute right-3 top-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white opacity-0 backdrop-blur transition hover:scale-110 hover:border-orange-400/50 group-hover:opacity-100 lg:flex">{theaterMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>

          <div className={`mt-4 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-4 backdrop-blur-xl light:border-black/[0.08] light:from-black/[0.04] light:to-transparent ${theaterMode ? "mx-auto max-w-[1300px]" : ""}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300 light:text-orange-700">More options</p><p className="mt-1 text-sm text-slate-400 light:text-slate-600">Save, share, or add this title to a playlist.</p></div>
              <WatchActions videoId={video.videoId} title={video.title} contentType={video.contentType} downloadStatus={video.downloadStatus} downloadRenditions={video.downloadRenditions} />
            </div>
          </div>

          <div className={theaterMode ? "mx-auto max-w-[1300px]" : ""}>
            {commentsOn ? <CommentSection videoId={video.videoId} /> : <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-400 light:border-black/[0.08] light:bg-black/[0.02] light:text-slate-600"><MessageSquareOff size={16} />Comments are turned off for this video.</div>}
          </div>
        </div>

        {!theaterMode && <aside className="xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-3 backdrop-blur-xl light:border-black/[0.08] light:bg-black/[0.025]">
            <div className="mb-3 flex items-center gap-2 px-1 pt-1"><span className="h-5 w-1 rounded-full bg-gradient-to-b from-orange-400 to-amber-300" /><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-300 light:text-orange-700">Keep watching</p><h2 className="text-base font-black text-white light:text-slate-900">Up Next</h2></div></div>
            <div className="space-y-2">
              {relatedVideos.length === 0 ? <p className="px-2 py-4 text-sm text-slate-500">No other videos yet.</p> : relatedVideos.map((related) => (
                <Link key={related.videoId} href={`/watch/${related.videoId}`} className="group flex gap-3 rounded-2xl p-2 transition hover:bg-white/[0.06] light:hover:bg-black/[0.04]">
                  <div className="relative h-[72px] w-[128px] flex-shrink-0 overflow-hidden rounded-xl bg-white/5 light:bg-black/5">{related.thumbnailUrl && <Image src={related.thumbnailUrl} alt={related.title} fill sizes="128px" className="object-cover transition duration-500 group-hover:scale-110" />}</div>
                  <div className="min-w-0 py-0.5"><h3 className="line-clamp-2 text-sm font-bold text-white transition group-hover:text-orange-300 light:text-slate-900">{related.title}</h3><p className="mt-1 truncate text-xs text-slate-400 light:text-slate-600">{related.uploaderName}</p><p className="mt-0.5 text-[11px] text-slate-500">{formatViews(related.views || 0)} • {formatTimeAgo(related.uploadedAt)}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </aside>}
      </div>
    </div>
  );
}
