"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Heart, Loader2, ThumbsUp, Film } from "lucide-react";
import BackButton from "@/app/components/BackButton";
import { HomeVideoCard } from "@/app/components/RecommendationFeed";
import { useAuthModal } from "@/app/components/auth/AuthProvider";
import { formatTimeAgo, formatViews } from "@/app/lib/formatters";
import type { Recommendation } from "@/app/data/recommendations";

interface LikedVideoItem {
  videoId: string;
  title: string;
  uploaderId: string;
  uploaderName: string;
  uploaderUsername?: string;
  uploaderAvatarUrl?: string;
  thumbnailUrl?: string;
  views?: number;
  uploadedAt: string;
  category?: string;
  likedAt?: string;
}

export default function LikedVideosPage() {
  const { signedIn, openSignIn } = useAuthModal();
  const [videos, setVideos] = useState<LikedVideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadLikedVideos() {
      setLoading(true);
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        if (!idToken) return;

        const res = await fetch("/api/likes/my-likes", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (!cancelled) {
          setVideos(data.videos || []);
        }
      } catch (err) {
        console.error("Failed to load liked videos:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLikedVideos();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!signedIn) {
    return (
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#07111F] p-12 text-center light:border-black/10 light:bg-white">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <Heart size={32} />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white light:text-slate-900">Sign in to see your Liked Videos</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
            Save videos you love by clicking the like button on any creator&apos;s video.
          </p>
          <button
            onClick={openSignIn}
            className="mt-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-2.5 text-sm font-bold text-slate-900 shadow-lg hover:scale-105 transition"
          >
            Sign In
          </button>
        </div>
      </main>
    );
  }

  const recommendations: Recommendation[] = videos.map((v) => ({
    id: v.videoId,
    videoId: v.videoId,
    title: v.title,
    creator: v.uploaderName,
    uploaderUsername: v.uploaderUsername || v.uploaderName,
    avatar: v.uploaderAvatarUrl || "/avatars/avatar.png",
    thumbnail: v.thumbnailUrl || "/recommendations/thumbnails/1.jpg",
    views: `${formatViews(v.views || 0)} views`,
    uploaded: formatTimeAgo(v.uploadedAt),
    duration: "Video",
  }));

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <BackButton />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg">
          <ThumbsUp size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white sm:text-3xl light:text-slate-900">Liked Videos</h1>
          <p className="text-xs text-slate-400 light:text-slate-600 font-medium">
            {videos.length} {videos.length === 1 ? "video" : "videos"} you&apos;ve liked
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 size={32} className="animate-spin text-orange-400" />
        </div>
      ) : videos.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-[#07111F] p-12 text-center light:border-black/10 light:bg-white">
          <Film size={36} className="text-slate-500 mb-3" />
          <h2 className="text-lg font-bold text-white light:text-slate-900">No liked videos yet</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-400 light:text-slate-600">
            When you like videos across InPlayer, they will automatically appear in this collection.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {recommendations.map((video) => (
            <HomeVideoCard key={video.videoId} video={video} />
          ))}
        </div>
      )}
    </main>
  );
}
