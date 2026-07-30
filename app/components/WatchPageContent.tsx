"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import { Maximize2, MessageSquareOff, Minimize2, ShieldAlert } from "lucide-react";
import VideoPlayer from "@/app/components/VideoPlayer";
import MembersOnlyVideoPlayer from "@/app/components/MembersOnlyVideoPlayer";
import CommentSection from "@/app/components/CommentSection";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import WatchActions from "@/app/components/watch/WatchActions";
import WatchMeta from "@/app/components/watch/WatchMeta";

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
  // Absent for a members-only video — the server never includes the real
  // playback ID in this payload for one (see app/watch/[videoId]/page.tsx
  // and app/api/videos/[videoId]/playback-token); MembersOnlyVideoPlayer
  // fetches it itself, authenticated, only for a viewer who actually
  // qualifies.
  muxPlaybackId?: string;
  membersOnly?: boolean;
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
  const [descExpanded, setDescExpanded] = useState(false);
  const commentsOn = video.commentsEnabled !== false;
  const showPlayer = !video.ageRestricted || ageConfirmed;
  const trimmedDescription = video.description?.trim() || "";
  const hasMoreInfo = trimmedDescription.length > 0 || (video.tags && video.tags.length > 0);

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
      <div className={`grid grid-cols-1 gap-6 transition-all duration-500 ${theaterMode ? "" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
        <div className="min-w-0">
          {/* The player is the very first thing on the page — no banner
              above it (there used to be a large cinematic hero here that
              pushed the actual player down and shrank it). -mx-3/lg:mx-0
              cancels the shared page container's horizontal padding
              (app/watch/[videoId]/page.tsx) so the player alone runs
              edge-to-edge on mobile/tablet portrait, like YouTube —
              everything else on this page (title, actions, comments,
              sidebar) keeps its normal inset. Card look (rounded corners,
              border, shadow) returns at lg: (desktop/tablet landscape),
              matching this app's existing mobile-vs-desktop breakpoint. */}
          <div id="watch-player" className="group relative scroll-mt-5 -mx-3 lg:mx-0">
            <div className={`overflow-hidden rounded-none border-0 border-white/10 bg-black shadow-none light:border-black/10 lg:rounded-[28px] lg:border lg:shadow-[0_25px_70px_rgba(0,0,0,.4)] ${theaterMode ? "mx-auto max-w-[1300px]" : ""}`}>
              {showPlayer ? (
                video.membersOnly ? (
                  <MembersOnlyVideoPlayer
                    videoId={video.videoId}
                    title={video.title}
                    uploaderId={video.uploaderId}
                    uploaderName={video.uploaderName}
                  />
                ) : (
                  <VideoPlayer playbackId={video.muxPlaybackId || ""} title={video.title} videoId={video.videoId} />
                )
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400"><ShieldAlert size={26} /></div>
                  <div><p className="text-base font-bold text-white">Age-restricted video</p><p className="mt-1 max-w-sm text-sm text-slate-400">This video is intended for viewers 18 and older.</p></div>
                  <button onClick={() => setAgeConfirmed(true)} className="rounded-full bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(255,153,0,.3)] transition hover:-translate-y-0.5">I&apos;m 18 or older — continue</button>
                </div>
              )}
            </div>
            <button onClick={() => setTheaterMode((active) => !active)} title={theaterMode ? "Exit theater mode" : "Theater mode"} className="absolute right-3 top-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white opacity-0 backdrop-blur transition hover:scale-110 hover:border-orange-400/50 group-hover:opacity-100 lg:flex">{theaterMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
          </div>

          {/* Title + views/date/category, directly under the player — the
              same spot YouTube puts them, now that there's no banner
              above the player pushing everything else down. */}
          <div className={`mt-4 ${theaterMode ? "mx-auto max-w-[1300px]" : ""}`}>
            <h1 className="text-lg font-black leading-snug text-white sm:text-xl light:text-slate-900">{video.title}</h1>
            <div className="mt-2">
              <WatchMeta views={video.views} uploadedAt={video.uploadedAt} category={video.category} ageRestricted={video.ageRestricted} />
            </div>
          </div>

          <div className={`mt-3 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-4 sm:p-5 backdrop-blur-xl light:border-black/[0.08] light:from-black/[0.04] light:to-transparent ${theaterMode ? "mx-auto max-w-[1300px]" : ""}`}>
            <WatchActions
              videoId={video.videoId}
              title={video.title}
              contentType={video.contentType}
              downloadStatus={video.downloadStatus}
              downloadRenditions={video.downloadRenditions}
              uploaderId={video.uploaderId}
              uploaderName={video.uploaderName}
              uploaderUsername={video.uploaderUsername}
              uploaderAvatarUrl={video.uploaderAvatarUrl}
            />
          </div>

          {/* Collapsible description/tags card — YouTube's own "Show
              more" pattern, tucked below the actions row instead of
              taking up a full banner above the player. */}
          {hasMoreInfo && (
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              className={`mt-3 w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:bg-white/[0.035] light:border-black/[0.08] light:bg-black/[0.015] light:hover:bg-black/[0.03] ${theaterMode ? "mx-auto max-w-[1300px]" : ""}`}
            >
              {trimmedDescription && (
                <p className={`whitespace-pre-wrap text-sm leading-6 text-slate-300 light:text-slate-700 ${descExpanded ? "" : "line-clamp-2"}`}>
                  {trimmedDescription}
                </p>
              )}
              {video.tags && video.tags.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${trimmedDescription ? "mt-3" : ""}`}>
                  {video.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-200 backdrop-blur-sm light:border-black/10 light:bg-white/40 light:text-slate-700">#{tag}</span>
                  ))}
                </div>
              )}
              <span className="mt-2 inline-block text-xs font-bold text-orange-300 light:text-orange-700">
                {descExpanded ? "Show less" : "Show more"}
              </span>
            </button>
          )}

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
