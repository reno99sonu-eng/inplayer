"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import { Lock, UserCheck, MessageSquare, Film, Loader2 } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import SubscribeButton from "@/app/components/SubscribeButton";
import BackButton from "@/app/components/BackButton";
import { formatViews, formatTimeAgo } from "@/app/lib/formatters";
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
  avatarUrl: string | null;
  usernamePrivacy: "public" | "private" | "connections";
  isOwner: boolean;
  gated: boolean;
  socialLinks?: { social: Record<string, string>; other: { label: string; url: string }[] };
  subscriberCount?: number;
  videos?: PublicVideo[];
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X (Twitter)",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { signedIn, user } = useAuthModal();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
      } catch (err) {
        console.error("Failed to load channel:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.username, signedIn]);

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
    if (!signedIn) return;
    if (!user) return;
    const conversationId = makeConversationId(user.userId, profile.userId);
    router.push(`/messages/${conversationId}?with=${encodeURIComponent(profile.username)}`);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:py-12">
      <BackButton />

      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full ring-4 ring-orange-400/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a data URL; matches app/profile/page.tsx's own avatar rendering. */}
          <img
            src={profile.avatarUrl || "/avatars/avatar.png"}
            alt={profile.username}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black text-white light:text-slate-900">
            @{profile.username}
          </h1>
          {!profile.gated && (
            <p className="mt-1 text-sm text-slate-400 light:text-slate-600">
              {(profile.subscriberCount || 0).toLocaleString()} In-Family members
            </p>
          )}

          {!profile.isOwner && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <SubscribeButton creatorId={profile.userId} />
              <button
                onClick={goToMessage}
                disabled={!signedIn}
                className="flex items-center gap-1.5 rounded-full border border-white/15 light:border-black/20 px-4 py-2 text-sm font-bold text-slate-200 light:text-slate-800 transition hover:bg-white/5 light:hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquare size={15} />
                Message
              </button>
            </div>
          )}
        </div>
      </div>

      {profile.gated ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 light:border-black/15 py-16 text-center">
          {profile.usernamePrivacy === "private" ? (
            <Lock size={28} className="mb-3 text-slate-500" />
          ) : (
            <UserCheck size={28} className="mb-3 text-slate-500" />
          )}
          <p className="font-semibold text-white light:text-slate-900">
            {profile.usernamePrivacy === "private"
              ? "This account is private"
              : "This account is only visible to connections"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-400 light:text-slate-600">
            {profile.usernamePrivacy === "private"
              ? "Only @" + profile.username + " can see their videos and links."
              : "Follow each other (mutual In-Family) to see their videos and links."}
          </p>
        </div>
      ) : (
        <>
          {(Object.keys(profile.socialLinks?.social || {}).length > 0 ||
            (profile.socialLinks?.other?.length || 0) > 0) && (
            <div className="mt-8 flex flex-wrap gap-2">
              {Object.entries(profile.socialLinks?.social || {}).map(([key, url]) =>
                url ? (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="rounded-full border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-3.5 py-1.5 text-xs font-semibold text-slate-300 light:text-slate-700 transition hover:border-orange-400/40 hover:text-orange-300 light:hover:text-orange-700"
                  >
                    {SOCIAL_LABELS[key] || key}
                  </a>
                ) : null
              )}
              {(profile.socialLinks?.other || []).map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="rounded-full border border-white/10 light:border-black/10 bg-white/[0.03] light:bg-black/[0.02] px-3.5 py-1.5 text-xs font-semibold text-slate-300 light:text-slate-700 transition hover:border-orange-400/40 hover:text-orange-300 light:hover:text-orange-700"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-4 text-sm font-black text-white light:text-slate-900">Videos</h2>
            {!profile.videos || profile.videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 light:border-black/10 py-14 text-center">
                <Film size={28} className="mb-2 text-slate-600" />
                <p className="text-sm text-slate-400 light:text-slate-600">
                  No public videos yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {profile.videos.map((video) => (
                  <Link key={video.videoId} href={`/watch/${video.videoId}`} className="group">
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-white/5 light:bg-black/5">
                      {video.thumbnailUrl && (
                        <Image
                          src={video.thumbnailUrl}
                          alt={video.title}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white light:text-slate-900">
                      {video.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400 light:text-slate-600">
                      {formatViews(video.views)} • {formatTimeAgo(video.uploadedAt)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
