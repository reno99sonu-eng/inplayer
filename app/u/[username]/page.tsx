"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import { BadgeCheck, Film, Loader2, Lock, MessageSquare, Search, UserCheck } from "lucide-react";

import { useAuthModal } from "@/app/components/auth/AuthProvider";
import BackButton from "@/app/components/BackButton";
import SubscribeButton from "@/app/components/SubscribeButton";
import MembershipButton from "@/app/components/MembershipButton";
import ShortsShelf from "@/app/components/ShortsShelf";
import { HomeVideoCard } from "@/app/components/RecommendationFeed";
import type { Recommendation } from "@/app/data/recommendations";
import type { Short } from "@/app/data/shorts";
import type { ChannelVideo } from "@/app/components/channel/ChannelVideoCard";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import { makeConversationId } from "@/app/lib/conversationId";

interface PublicProfile {
  found: true;
  userId: string;
  username: string;
  name: string;
  description?: string;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  isVerified?: boolean;
  usernamePrivacy: "public" | "private" | "connections";
  isOwner: boolean;
  gated: boolean;
  socialLinks?: { social: Record<string, string>; other: { label: string; url: string }[] };
  subscriberCount?: number;
  totalViews?: number;
  videos?: ChannelVideo[];
}

type Sort = "most-viewed" | "latest" | "oldest";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram", youtube: "YouTube", x: "X (Twitter)", facebook: "Facebook", tiktok: "TikTok",
};

function sortVideos(videos: ChannelVideo[], sort: Sort) {
  return [...videos].sort((a, b) => {
    if (sort === "latest") return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    if (sort === "oldest") return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    return (b.views || 0) - (a.views || 0);
  });
}

function SortControls({ sort, onChange }: { sort: Sort; onChange: (sort: Sort) => void }) {
  return <div className="flex gap-2 overflow-x-auto">{[
    ["most-viewed", "Most Viewed"], ["latest", "Newest"], ["oldest", "Oldest"],
  ].map(([id, label]) => <button key={id} onClick={() => onChange(id as Sort)} className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-bold transition ${sort === id ? "border-orange-400/50 bg-orange-500/15 text-orange-200 light:text-orange-700" : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white light:border-black/10 light:text-slate-600"}`}>{label}</button>)}</div>;
}

function EmptyCollection({ label }: { label: string }) {
  return <div className="mt-5 flex flex-col items-center justify-center rounded-3xl border border-white/10 py-16 text-center light:border-black/10"><Film size={28} className="mb-3 text-slate-600" /><p className="text-sm text-slate-400 light:text-slate-600">No matching public {label} yet.</p></div>;
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { signedIn, user } = useAuthModal();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sort, setSort] = useState<Sort>("most-viewed");
  const [searchQuery, setSearchQuery] = useState("");
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
        const response = await fetch(`/api/users/${encodeURIComponent(params.username)}`, { headers });
        if (cancelled) return;
        if (!response.ok) { setNotFound(true); return; }
        setProfile(await response.json());
        setVisibleCount(12);
      } catch (error) {
        console.error("Failed to load channel:", error);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [params.username, signedIn]);

  const allVideos = useMemo(() => profile?.videos ?? [], [profile]);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const matchingVideos = useMemo(() => allVideos.filter((video) => !normalizedQuery || video.title.toLocaleLowerCase().includes(normalizedQuery)), [allVideos, normalizedQuery]);
  const regularVideos = useMemo(() => sortVideos(matchingVideos.filter((video) => video.contentType !== "short"), sort), [matchingVideos, sort]);
  const shortVideos = useMemo(() => sortVideos(matchingVideos.filter((video) => video.contentType === "short"), sort), [matchingVideos, sort]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={28} className="animate-spin text-orange-400" /></div>;
  if (notFound || !profile) return <div className="mx-auto max-w-[720px] px-4 py-8 sm:py-12"><BackButton /><div className="flex flex-col items-center justify-center py-16 text-center"><p className="font-semibold text-white light:text-slate-900">No channel at @{params.username}</p><p className="mt-1 text-sm text-slate-400 light:text-slate-600">Double-check the username and try again.</p></div></div>;

  // A real, creator-chosen cover photo always wins over the old fallback
  // (borrowing whichever video happened to be most-viewed as a makeshift
  // banner) — that fallback stays in place for channels that haven't set
  // one yet, so the header never regresses to a blank/empty look.
  const bannerImage = profile.coverPhotoUrl || allVideos[0]?.thumbnailUrl;
  const videos: Recommendation[] = regularVideos.map((video) => ({ id: video.videoId, videoId: video.videoId, title: video.title, creator: profile.name || profile.username, uploaderUsername: profile.username, avatar: profile.avatarUrl || "/avatars/avatar.png", thumbnail: video.thumbnailUrl || "/recommendations/thumbnails/1.jpg", views: `${formatViews(video.views || 0)} views`, uploaded: formatTimeAgo(video.uploadedAt), duration: "Video", verified: profile.isVerified }));
  const shorts: Short[] = shortVideos.map((video) => ({ id: video.videoId, videoId: video.videoId, title: video.title, creator: profile.name || profile.username, poster: video.thumbnailUrl || "/shorts/1.jpg", views: `${formatViews(video.views || 0)} views`, likes: "0", comments: "0", uploaderId: profile.userId, uploaderUsername: profile.username, uploaderAvatarUrl: profile.avatarUrl || undefined }));
  const socialLinks = [...Object.entries(profile.socialLinks?.social || {}).map(([key, url]) => ({ label: SOCIAL_LABELS[key] || key, url })), ...(profile.socialLinks?.other || [])].filter((link): link is { label: string; url: string } => Boolean(link.url));
  const updateSort = (nextSort: Sort) => { setSort(nextSort); setVisibleCount(12); };
  const goToMessage = () => { if (signedIn && user) router.push(`/messages/${makeConversationId(user.userId, profile.userId)}?with=${encodeURIComponent(profile.username)}`); };

  return <main className="mx-auto max-w-[1800px] px-4 py-4 [&>section>div:last-child]:!pt-20 sm:px-6 sm:py-5 sm:[&>section>div:last-child]:!pt-28 lg:px-8 lg:[&>section>div:last-child]:!pt-32">
    <div className="mb-3 hidden lg:block"><BackButton /></div>
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#0a1020] shadow-[0_20px_60px_rgba(0,0,0,.28)] light:border-black/10 light:bg-[#efe6d0]">
      <div className="absolute inset-0">{bannerImage ? <Image src={bannerImage} alt="" fill priority sizes="100vw" className="object-cover opacity-40" /> : <div className="h-full bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,.48),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(251,191,36,.24),transparent_25%),linear-gradient(120deg,#10182d,#030712)]" />}<div className="absolute inset-0 bg-gradient-to-r from-[#060a14] via-[#060a14]/88 to-[#060a14]/50 light:from-[#f4ecda] light:via-[#f4ecda]/88 light:to-[#f4ecda]/45" /></div>
      <div className="relative px-5 pb-7 pt-28 sm:px-8 sm:pt-40 lg:px-12 lg:pb-10 lg:pt-48"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end"><div className="relative h-24 w-24 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-orange-600 p-1 shadow-[0_0_45px_rgba(249,115,22,.45)] sm:h-32 sm:w-32"><Image src={profile.avatarUrl || "/avatars/avatar.png"} alt={profile.name || profile.username} fill unoptimized sizes="128px" className="rounded-full object-cover ring-4 ring-[#060a14] light:ring-[#f4ecda]" /></div><div className="min-w-0 text-left"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl light:text-slate-900">{profile.name || profile.username}</h1>{profile.isVerified && <BadgeCheck size={24} className="fill-orange-400 text-[#101827]" aria-label="Verified creator" />}</div><p className="mt-1 truncate text-sm font-semibold text-orange-200 light:text-orange-700">@{profile.username}</p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-300 light:text-slate-700 sm:text-sm"><span>{(profile.subscriberCount || 0).toLocaleString()} subscribers</span><span className="text-orange-300/70">•</span><span>{formatViews(profile.totalViews || 0)} total views</span></div></div></div>{!profile.isOwner && <div className="flex flex-wrap gap-2"><SubscribeButton creatorId={profile.userId} /><MembershipButton creatorId={profile.userId} creatorName={profile.name || profile.username} /><button onClick={goToMessage} disabled={!signedIn} className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-md transition hover:border-orange-400/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 light:border-black/15 light:bg-white/35 light:text-slate-900"><MessageSquare size={16} /> Message</button></div>}</div></div>
    </section>
    {profile.gated ? <div className="mt-7 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 py-16 text-center light:border-black/15">{profile.usernamePrivacy === "private" ? <Lock size={28} className="mb-3 text-slate-500" /> : <UserCheck size={28} className="mb-3 text-slate-500" />}<p className="font-semibold text-white light:text-slate-900">{profile.usernamePrivacy === "private" ? "This account is private" : "This account is only visible to connections"}</p><p className="mt-1 max-w-xs text-sm text-slate-400 light:text-slate-600">{profile.usernamePrivacy === "private" ? `Only @${profile.username} can see their channel.` : "Follow each other (mutual In-Family) to see this channel."}</p></div> : <>
      <section className="mt-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Channel library</p><h2 className="mt-1 text-xl font-black text-white light:text-slate-900">Videos</h2></div><SortControls sort={sort} onChange={updateSort} /></div><label className="mt-3 flex max-w-md min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-slate-400 focus-within:border-orange-400/40 light:border-black/10 light:bg-white/40"><Search size={16} className="text-orange-400" /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(12); }} placeholder="Search this channel" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 light:text-slate-900" /></label>{videos.length ? <><div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{videos.slice(0, visibleCount).map((video) => <HomeVideoCard key={video.videoId} video={video} />)}</div>{visibleCount < videos.length && <div className="mt-5 flex justify-center"><button onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-orange-400/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-200 transition hover:bg-orange-500/20 light:text-orange-700">Load more videos</button></div>}</> : <EmptyCollection label="videos" />}</section>
      <section className="mt-7"><div className="mb-2"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Quick plays</p><h2 className="mt-1 text-xl font-black text-white light:text-slate-900">Shorts</h2></div>{shorts.length ? <ShortsShelf items={shorts} /> : <EmptyCollection label="Shorts" />}</section>
      <section className="mt-7 rounded-2xl border border-white/[0.09] bg-white/[0.035] p-5 backdrop-blur-xl light:border-black/[0.09] light:bg-black/[0.025]"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">About</p><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-300 light:text-slate-700">{profile.description?.trim() || "No channel description provided."}</p>{socialLinks.length > 0 && <div className="mt-5"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300 light:text-orange-700">Elsewhere</p><div className="mt-3 flex flex-wrap gap-2">{socialLinks.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-orange-400/40 hover:text-orange-300 light:border-black/10 light:text-slate-700">{link.label}</a>)}</div></div>}</section>
    </>}
  </main>;
}
