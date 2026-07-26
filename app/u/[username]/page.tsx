"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import {
  BadgeCheck,
  FileText,
  Film,
  LayoutDashboard,
  Loader2,
  Lock,
  MessageSquare,
  Play,
  Search,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import SubscribeButton from "@/app/components/SubscribeButton";
import BackButton from "@/app/components/BackButton";
import ChannelVideoCard, {
  type ChannelVideo,
} from "@/app/components/channel/ChannelVideoCard";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import { makeConversationId } from "@/app/lib/conversationId";

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
  joinedAt?: string | null;
  videos?: ChannelVideo[];
}

type Sort = "most-viewed" | "latest" | "oldest";
type ChannelTab = "home" | "videos" | "shorts" | "playlists" | "about";

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X (Twitter)",
  facebook: "Facebook",
  tiktok: "TikTok",
};

const TABS: { id: ChannelTab; label: string; icon: typeof Video }[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "videos", label: "Videos", icon: Video },
  { id: "shorts", label: "Shorts", icon: Film },
  { id: "playlists", label: "Playlists", icon: Sparkles },
  { id: "about", label: "About", icon: FileText },
];

function formatJoinedDate(value?: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function sortVideos(videos: ChannelVideo[], sort: Sort) {
  return [...videos].sort((a, b) => {
    if (sort === "latest") {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    }
    if (sort === "oldest") {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    }
    return (b.views || 0) - (a.views || 0);
  });
}

function EmptyCollection({ label }: { label: string }) {
  return (
    <div className="mt-5 flex flex-col items-center justify-center rounded-3xl border border-white/10 py-16 text-center light:border-black/10">
      <Film size={28} className="mb-3 text-slate-600" />
      <p className="text-sm text-slate-400 light:text-slate-600">
        No matching public {label} yet.
      </p>
    </div>
  );
}

function SortControls({
  sort,
  onChange,
  shortsOnly = false,
}: {
  sort: Sort;
  onChange: (sort: Sort) => void;
  shortsOnly?: boolean;
}) {
  const options: { id: Sort; label: string }[] = shortsOnly
    ? [
        { id: "most-viewed", label: "Most Viewed" },
        { id: "latest", label: "Latest" },
      ]
    : [
        { id: "most-viewed", label: "Most Viewed" },
        { id: "latest", label: "Latest" },
        { id: "oldest", label: "Oldest" },
      ];

  return (
    <div className="flex gap-2 overflow-x-auto">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-bold transition ${
            sort === option.id
              ? "border-orange-400/50 bg-orange-500/15 text-orange-200 light:text-orange-700"
              : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-white light:border-black/10 light:text-slate-600"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { signedIn, user } = useAuthModal();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<ChannelTab>("home");
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
        const res = await fetch(`/api/users/${encodeURIComponent(params.username)}`, { headers });
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
    return () => { cancelled = true; };
  }, [params.username, signedIn]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 size={28} className="animate-spin text-orange-400" /></div>;
  }

  if (notFound || !profile) {
    return <div className="mx-auto max-w-[720px] px-4 py-8 sm:py-12"><BackButton /><div className="flex flex-col items-center justify-center py-16 text-center"><p className="font-semibold text-white light:text-slate-900">No channel at @{params.username}</p><p className="mt-1 text-sm text-slate-400 light:text-slate-600">Double-check the username and try again.</p></div></div>;
  }

  const allVideos = profile.videos || [];
  const query = searchQuery.trim().toLocaleLowerCase();
  const matches = allVideos.filter((video) => !query || video.title.toLocaleLowerCase().includes(query));
  const regularVideos = matches.filter((video) => video.contentType !== "short");
  const shortVideos = matches.filter((video) => video.contentType === "short");
  const sortedVideos = sortVideos(regularVideos, sort);
  const sortedShorts = sortVideos(shortVideos, sort === "oldest" ? "latest" : sort);
  const featuredVideo = sortVideos(allVideos.filter((video) => video.contentType !== "short"), "most-viewed")[0];
  const totalVideos = allVideos.filter((video) => video.contentType !== "short").length;
  const totalShorts = allVideos.filter((video) => video.contentType === "short").length;
  const socialLinks = [
    ...Object.entries(profile.socialLinks?.social || {}).map(([key, url]) => ({ label: SOCIAL_LABELS[key] || key, url })),
    ...(profile.socialLinks?.other || []),
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));
  const setSortAndReset = (nextSort: Sort) => { setSort(nextSort); setVisibleCount(12); };
  const selectTab = (tab: ChannelTab) => { setActiveTab(tab); setVisibleCount(12); };
  const goToMessage = () => {
    if (!signedIn || !user) return;
    router.push(`/messages/${makeConversationId(user.userId, profile.userId)}?with=${encodeURIComponent(profile.username)}`);
  };
  const bannerImage = featuredVideo?.thumbnailUrl;

  return (
    <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-5 sm:py-7 lg:px-7">
      <div className="mb-4 hidden lg:block"><BackButton /></div>
      <section className="relative isolate overflow-hidden rounded-[30px] border border-white/10 bg-[#0a1020] shadow-[0_30px_100px_rgba(0,0,0,.4)] light:border-black/10 light:bg-[#efe6d0]">
        <div className="absolute inset-0">{bannerImage ? <Image src={bannerImage} alt="" fill priority sizes="100vw" className="object-cover opacity-55" /> : <div className="h-full bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,.48),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(251,191,36,.24),transparent_25%),linear-gradient(120deg,#10182d,#030712)]" />}<div className="absolute inset-0 bg-gradient-to-r from-[#060a14] via-[#060a14]/88 to-[#060a14]/50 light:from-[#f4ecda] light:via-[#f4ecda]/88 light:to-[#f4ecda]/45" /><div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#060a14] to-transparent light:from-[#f4ecda]" /></div>
        <div className="relative px-5 pb-7 pt-28 sm:px-8 sm:pt-40 lg:px-12 lg:pb-10 lg:pt-48"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end"><div className="relative h-24 w-24 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 via-amber-300 to-orange-600 p-1 shadow-[0_0_45px_rgba(249,115,22,.45)] sm:h-32 sm:w-32"><Image src={profile.avatarUrl || "/avatars/avatar.png"} alt={profile.name || profile.username} fill unoptimized sizes="128px" className="rounded-full object-cover ring-4 ring-[#060a14] light:ring-[#f4ecda]" /></div><div className="min-w-0 text-left"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl light:text-slate-900">{profile.name || profile.username}</h1>{profile.isVerified && <BadgeCheck size={24} className="fill-orange-400 text-[#101827]" aria-label="Verified creator" />}</div><p className="mt-1 text-sm font-semibold text-orange-200 light:text-orange-700">@{profile.username}</p><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-300 light:text-slate-700 sm:text-sm"><span>{(profile.subscriberCount || 0).toLocaleString()} subscribers</span><span className="text-orange-300/70">•</span><span>{formatViews(profile.totalViews || 0)} total</span><span className="text-orange-300/70">•</span><span>{totalVideos} videos</span><span className="text-orange-300/70">•</span><span>{totalShorts} shorts</span></div></div></div>{!profile.isOwner && <div className="flex flex-wrap gap-2"><SubscribeButton creatorId={profile.userId} /><button onClick={goToMessage} disabled={!signedIn} className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm font-bold text-white backdrop-blur-md transition hover:border-orange-400/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 light:border-black/15 light:bg-white/35 light:text-slate-900"><MessageSquare size={16} /> Message</button></div>}</div></div>
      </section>

      {profile.gated ? <div className="mt-7 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 py-16 text-center light:border-black/15">{profile.usernamePrivacy === "private" ? <Lock size={28} className="mb-3 text-slate-500" /> : <UserCheck size={28} className="mb-3 text-slate-500" />}<p className="font-semibold text-white light:text-slate-900">{profile.usernamePrivacy === "private" ? "This account is private" : "This account is only visible to connections"}</p><p className="mt-1 max-w-xs text-sm text-slate-400 light:text-slate-600">{profile.usernamePrivacy === "private" ? `Only @${profile.username} can see their channel.` : "Follow each other (mutual In-Family) to see this channel."}</p></div> : <>
        <section className="mt-6 rounded-3xl border border-white/[0.09] bg-white/[0.035] p-3 backdrop-blur-xl light:border-black/[0.09] light:bg-black/[0.025] sm:p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex max-w-full gap-1 overflow-x-auto pb-1">{TABS.map((tab) => { const Icon = tab.icon; return <button key={tab.id} onClick={() => selectTab(tab.id)} className={`flex items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2 text-xs font-black transition sm:px-4 sm:text-sm ${activeTab === tab.id ? "bg-gradient-to-r from-orange-500/25 to-amber-400/15 text-orange-100 shadow-[0_8px_24px_-14px_rgba(249,115,22,.8)] light:text-orange-700" : "text-slate-400 hover:bg-white/[0.05] hover:text-white light:hover:bg-black/[0.04] light:hover:text-slate-900"}`}><Icon size={15} />{tab.label}</button>; })}</div><label className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-slate-400 focus-within:border-orange-400/40 light:border-black/10 light:bg-white/40"><Search size={16} className="text-orange-400" /><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(12); }} placeholder="Search this channel" className="min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 light:text-slate-900" /></label></div></section>

        {activeTab === "home" && <section className="mt-7 space-y-9"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Total Videos", totalVideos], ["Total Shorts", totalShorts], ["Total Views", formatViews(profile.totalViews || 0)], ["Joined", formatJoinedDate(profile.joinedAt)]].map(([label, value]) => <div key={label} className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-4 light:border-black/[0.08] light:bg-black/[0.02]"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300 light:text-orange-700">{label}</p><p className="mt-2 text-xl font-black text-white light:text-slate-900">{value}</p></div>)}</div>{featuredVideo && <div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Featured video</p><Link href={`/watch/${featuredVideo.videoId}`} className="group mt-3 grid overflow-hidden rounded-[28px] border border-orange-400/20 bg-gradient-to-br from-white/[0.06] to-orange-500/[0.06] transition hover:border-orange-400/45 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]"><div className="relative aspect-video overflow-hidden">{featuredVideo.thumbnailUrl ? <Image src={featuredVideo.thumbnailUrl} alt={featuredVideo.title} fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover transition duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-orange-500/10"><Play className="text-orange-300" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" /></div><div className="flex flex-col justify-center p-6 sm:p-8"><span className="w-fit rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-200">Most viewed</span><h2 className="mt-4 text-2xl font-black leading-tight text-white transition group-hover:text-orange-300 light:text-slate-900 sm:text-3xl">{featuredVideo.title}</h2><p className="mt-3 text-sm text-slate-400 light:text-slate-600">{formatViews(featuredVideo.views || 0)} • {formatTimeAgo(featuredVideo.uploadedAt)}</p><span className="mt-6 flex items-center gap-2 text-sm font-black text-orange-300">Watch now <Play size={15} fill="currentColor" /></span></div></Link></div>}<div><div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Channel library</p><h2 className="mt-1 text-2xl font-black text-white light:text-slate-900">Videos</h2></div>{sortedVideos.length > 6 && <button onClick={() => selectTab("videos")} className="text-sm font-bold text-orange-300 hover:text-orange-200">View all</button>}</div>{sortedVideos.length ? <div className="mt-4 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3">{sortedVideos.slice(0, 6).map((video, index) => <ChannelVideoCard key={video.videoId} video={video} rank={sort === "most-viewed" && index < 3 ? index + 1 : undefined} />)}</div> : <EmptyCollection label="videos" />}</div><div><div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Quick plays</p><h2 className="mt-1 text-2xl font-black text-white light:text-slate-900">Shorts</h2></div>{sortedShorts.length > 6 && <button onClick={() => selectTab("shorts")} className="text-sm font-bold text-orange-300 hover:text-orange-200">View all</button>}</div>{sortedShorts.length ? <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{sortedShorts.slice(0, 6).map((video) => <ChannelVideoCard key={video.videoId} video={video} compact />)}</div> : <EmptyCollection label="Shorts" />}</div></section>}

        {activeTab === "videos" && <section className="mt-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Channel library</p><h2 className="mt-1 text-2xl font-black text-white light:text-slate-900">Videos</h2></div><SortControls sort={sort} onChange={setSortAndReset} /></div>{sortedVideos.length ? <><div className="mt-5 grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{sortedVideos.slice(0, visibleCount).map((video, index) => <ChannelVideoCard key={video.videoId} video={video} rank={sort === "most-viewed" && index < 3 ? index + 1 : undefined} />)}</div>{visibleCount < sortedVideos.length && <div className="mt-6 flex justify-center"><button onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-orange-400/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-200 transition hover:bg-orange-500/20 light:text-orange-700">Load more videos</button></div>}</> : <EmptyCollection label="videos" />}</section>}

        {activeTab === "shorts" && <section className="mt-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Quick plays</p><h2 className="mt-1 text-2xl font-black text-white light:text-slate-900">Shorts</h2></div><SortControls sort={sort} onChange={setSortAndReset} shortsOnly /></div>{sortedShorts.length ? <><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{sortedShorts.slice(0, visibleCount).map((video) => <ChannelVideoCard key={video.videoId} video={video} compact />)}</div>{visibleCount < sortedShorts.length && <div className="mt-6 flex justify-center"><button onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-orange-400/30 bg-orange-500/10 px-5 py-2.5 text-sm font-bold text-orange-200 transition hover:bg-orange-500/20 light:text-orange-700">Load more Shorts</button></div>}</> : <EmptyCollection label="Shorts" />}</section>}

        {activeTab === "playlists" && <section className="mt-7 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 px-5 text-center light:border-black/15"><Sparkles size={28} className="text-orange-400" /><h2 className="mt-4 text-xl font-black text-white light:text-slate-900">Playlists are coming soon</h2><p className="mt-2 max-w-md text-sm text-slate-400 light:text-slate-600">This channel will be able to organize its public videos and Shorts into curated collections here.</p></section>}

        {activeTab === "about" && <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]"><div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-6 backdrop-blur-xl light:border-black/[0.09] light:bg-black/[0.025]"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">About the channel</p><p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-300 light:text-slate-700">{profile.description?.trim() || "No channel description provided."}</p>{socialLinks.length > 0 && <div className="mt-7"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300 light:text-orange-700">Elsewhere</p><div className="mt-3 flex flex-wrap gap-2">{socialLinks.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:border-orange-400/40 hover:text-orange-300 light:border-black/10 light:text-slate-700">{link.label}</a>)}</div></div>}</div><div className="rounded-3xl border border-white/[0.09] bg-white/[0.035] p-6 backdrop-blur-xl light:border-black/[0.09] light:bg-black/[0.025]"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300 light:text-orange-700">Channel stats</p><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-400">Total videos</dt><dd className="font-bold text-white light:text-slate-900">{totalVideos}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Total Shorts</dt><dd className="font-bold text-white light:text-slate-900">{totalShorts}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Total views</dt><dd className="font-bold text-white light:text-slate-900">{formatViews(profile.totalViews || 0)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-400">Joined</dt><dd className="font-bold text-white light:text-slate-900">{formatJoinedDate(profile.joinedAt)}</dd></div></dl></div></section>}
      </>}
    </main>
  );
}
