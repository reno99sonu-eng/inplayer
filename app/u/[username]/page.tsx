"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  BadgeCheck,
  Calendar,
  Eye,
  Film,
  Loader2,
  Lock,
  MessageSquare,
  Play,
  Radio,
  UserCheck,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import SubscribeButton from "@/app/components/SubscribeButton";
import BackButton from "@/app/components/BackButton";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import { makeConversationId } from "@/app/lib/conversationId";

interface PublicVideo {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  views: number;
  uploadedAt: string;
  contentType: string;
}

interface PublicProfile {
  found: true;
  userId: string;
  username: string;
  name: string;
  description?: string;
  avatarUrl: string | null;
  isVerified?: boolean;
  usernamePrivacy: "public" | "private" | "connections";
  isOwner: boolean;
  gated: boolean;
  socialLinks?: {
    social: Record<string, string>;
    other: { label: string; url: string }[];
  };
  subscriberCount?: number;
  totalViews?: number;
  videos?: PublicVideo[];
}

type VideoFilter = "most-viewed" | "latest" | "oldest" | "shorts" | "live";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X (Twitter)",
  facebook: "Facebook",
  tiktok: "TikTok",
};

const FILTERS: { id: VideoFilter; label: string }[] = [
  { id: "most-viewed", label: "Most Viewed" },
  { id: "latest", label: "Latest" },
  { id: "oldest", label: "Oldest" },
  { id: "shorts", label: "Shorts" },
  { id: "live", label: "Live" },
];

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { signedIn, user } = useAuthModal();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState<VideoFilter>("most-viewed");
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        let headers: HeadersInit = {};
        if (signedIn) {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          if (idToken) headers = { Authorization: `Bearer ${idToken}` };
        }
        const res = await fetch(
          `/api/users/${encodeURIComponent(params.username)}`,
          { headers }
        );
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        setProfile(await res.json());
        setVisibleCount(12);
      } catch (err) {
        console.error("Failed to load channel:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.username, signedIn]);

  const videos = (profile?.videos || [])
    .filter((video) => {
      if (filter === "shorts") return video.contentType === "short";
      if (filter === "live") return video.contentType === "live";
      return true;
    })
    .sort((a, b) => {
      if (filter === "latest") {
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      }
      if (filter === "oldest") {
        return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      return (b.views || 0) - (a.views || 0);
    });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-8 sm:py-12">
        <BackButton />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-semibold text-white light:text-slate-900">
            No channel at @{params.username}
          </p>
          <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
            Double-check the username and try again.
          </p>
        </div>
      </div>
    );
  }

  const goToMessage = () => {
    if (!signedIn || !user) return;
    const conversationId = makeConversationId(user.userId, profile.userId);
    router.push(
      `/messages/${conversationId}?with=${encodeURIComponent(profile.username)}`
    );
  };
  const bannerImage = profile.videos?.[0]?.thumbnailUrl;
  const socialLinks = [
    ...Object.entries(profile.socialLinks?.social || {}).map(([key, url]) => ({
      label: SOCIAL_LABELS[key] || key,
      url,
    })),
    ...(profile.socialLinks?.other || []),
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));

  return (
    <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-7 lg:px-7">
      <div className="mb-4 hidden lg:block"><BackButton /></div>

      <section className="relative isolate overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1020] shadow-[0_30px_100px_rgba(0,0,0,.4)] light:border-black/10 light:bg-[#efe6d0]">
        <div className="absolute inset-0">
          {bannerImage ? (
            <Image src={bannerImage} alt="" fill priority sizes="100vw" className="object-cover opacity-55" />
          ) : (
            <div className="h-full bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,.48),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(251,191,36,.24),transparent_25%),linear-gradient(120deg,#10182d,#030712)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#060a14] via-[#060a14]/88 to-[#060a14]/50 light:from-[#f4ecda] light:via-[#f4ecda]/88 light:to-[#f4ecda]/45" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#060a14] to-transparent light:from-[#f4ecda]" />
        </div>

        <div className="relative px-5 pb-7 pt-28 sm:px-8 sm:pt-40 lg:px-12 lg:pb-10 lg:pt-48">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative h-24 w-24 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-orange-600 p-1 shadow-[0_0_45px_rgba(249,115,22,.45)] sm:h-32 sm:w-32">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatars can be data URLs. */}
                <img src={profile.avatarUrl || "/avatars/avatar.png"} alt={profile.name || profile.username} className="h-full w-full rounded-full object-cover ring-4 ring-[#060a14] light:ring-[#f4ecda]" />
              </div>
              <div className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl light:text-slate-900">{profile.name || profile.username}</h1>
                  {profile.isVerified && <BadgeCheck size={24} className="fill-orange-400 text-[#101827]" aria-label="Verified creator" />}
                </div>
                <p className="mt-1 text-sm font-semibold text-orange-200 light:text-orange-700">@{profile.username}</p>
                {!profile.gated && (
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-300 light:text-slate-700 sm:text-sm">
                    <span>{(profile.subscriberCount || 0).toLocaleString()} subscribers</span>
                    <span className="text-orange-300/70">•</span>
                    <span>{formatViews(profile.totalViews || 0)} total</span>
                    <span className="text-orange-300/70">•</span>
                    <span>{profile.videos?.length || 0} videos</span>
                  </div>
                )}
              </div>
            </div>

            {!profile.gated && !profile.isOwner && (
              <div className="flex flex-wrap gap-2">
                <SubscribeButton creatorId={profile.userId} />
                <button onClick={goToMessage} disabled={!signedIn} className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-md transition hover:border-orange-400/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 light:border-black/15 light:bg-white/35 light:text-slate-900">
                  <MessageSquare size={16} /> Message
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {profile.gated ? (
        <div className="mt-7 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 py-16 text-center light:border-black/15">
          {profile.usernamePrivacy === "private" ? <Lock size={28} className="mb-3 text-slate-500" /> : <UserCheck size={28} className="mb-3 text-slate-500" />}
          <p className="font-semibold text-white light:text-slate-900">{profile.usernamePrivacy === "private" ? "This account is private" : "This account is only visible to connections"}</p>
          <p className="mt-1 max-w-xs text-sm text-slate-400 light:text-slate-600">{profile.usernamePrivacy === "private" ? `Only @${profile.username} can see their channel.` : "Follow each other (mutual In-Family) to see this channel."}</p>
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-5 backdrop-blur-xl light:border-black/[0.09] light:bg-black/[0.025]">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">About the channel</p>
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-300 light:text-slate-700">{profile.description?.trim() || "No channel description provided."}</p>
            </div>
            {socialLinks.length > 0 && (
              <div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-5 backdrop-blur-xl light:border-black/[0.09] light:bg-black/[0.025]">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Elsewhere</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {socialLinks.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-orange-400/40 hover:text-orange-300 light:border-black/10 light:text-slate-700">{link.label}</a>)}
                </div>
              </div>
            )}
          </section>

          <section className="mt-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Channel library</p><h2 className="mt-1 text-2xl font-black text-white light:text-slate-900">Videos</h2></div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {FILTERS.map((option) => <button key={option.id} onClick={() => { setFilter(option.id); setVisibleCount(12); }} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-bold transition ${filter === option.id ? "border-orange-400/50 bg-orange-500/15 text-orange-200 light:text-orange-700" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white light:border-black/10 light:text-slate-600"}`}>{option.label}</button>)}
                <span className="whitespace-nowrap rounded-full border border-white/5 px-3.5 py-2 text-xs font-bold text-slate-600 light:border-black/5">Playlists soon</span>
              </div>
            </div>

            {videos.length === 0 ? (
              <div className="mt-5 flex flex-col items-center justify-center rounded-3xl border border-white/10 py-16 text-center light:border-black/10"><Film size={28} className="mb-3 text-slate-600" /><p className="text-sm text-slate-400 light:text-slate-600">No public videos in this collection yet.</p></div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {videos.slice(0, visibleCount).map((video, index) => (
                    <Link key={video.videoId} href={`/watch/${video.videoId}`} className="group rounded-3xl border border-white/[0.08] bg-white/[0.025] p-2.5 transition duration-300 hover:-translate-y-1 hover:border-orange-400/35 hover:bg-white/[0.05] hover:shadow-[0_20px_45px_-25px_rgba(249,115,22,.6)] light:border-black/[0.08] light:bg-black/[0.02]">
                      <div className="relative aspect-video overflow-hidden rounded-2xl bg-white/5 light:bg-black/5">
                        {video.thumbnailUrl ? <Image src={video.thumbnailUrl} alt={video.title} fill sizes="(max-width: 520px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-500/20 to-slate-900"><Play className="text-white/70" /></div>}
                        {index < 3 && filter === "most-viewed" && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-orange-300 backdrop-blur">#{index + 1} most viewed</span>}
                        {video.contentType === "live" && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white"><Radio size={10} /> LIVE</span>}
                      </div>
                      <div className="px-1 pb-1 pt-3"><h3 className="line-clamp-2 text-sm font-bold text-white transition group-hover:text-orange-300 light:text-slate-900">{video.title}</h3><div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 light:text-slate-600"><Eye size={13} className="text-orange-400" />{formatViews(video.views || 0)}<span>•</span><Calendar size={12} />{formatTimeAgo(video.uploadedAt)}</div></div>
                    </Link>
                  ))}
                </div>
                {visibleCount < videos.length && <div className="mt-6 flex justify-center"><button onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-orange-400/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-200 transition hover:bg-orange-500/20 light:text-orange-700">Load more videos</button></div>}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
