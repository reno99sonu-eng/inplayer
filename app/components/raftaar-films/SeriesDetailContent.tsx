"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronLeft, Share2, Plus, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SeriesDetailContent({ series, episodes, user }: any) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Assuming episodes are sorted by episodeNumber
  const firstEpisode = episodes?.[0];
  const nextEpisode = firstEpisode; // In real app, check user progress

  const handleFollow = async () => {
    try {
      // Optistic UI update
      setIsFollowing(true);
      const res = await fetch(`/api/raftaar-films/series/${series.seriesId}/subscribe`, {
        method: "POST",
      });
      if (!res.ok) setIsFollowing(false);
    } catch (e) {
      setIsFollowing(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: series.title,
        text: series.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F13] text-white pb-24 max-w-md mx-auto relative overflow-hidden">
      {/* Top Banner & Header */}
      <div className="relative h-72 w-full bg-zinc-950">
        <img
          src={series.bannerUrl || series.posterUrl || series.thumbnailUrl || '/placeholder-vertical.svg'}
          alt={series.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== '/placeholder-vertical.svg') {
              target.src = '/placeholder-vertical.svg';
            }
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F13] via-[#0F0F13]/40 to-transparent" />
        
        {/* Header Actions */}
        <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button 
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Title & Meta over gradient */}
        <div className="absolute bottom-4 px-4 w-full">
          <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-md">{series.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
            {series.tags?.slice(0, 3).map((tag: string, i: number) => (
              <span key={i} className="bg-white/10 px-2.5 py-1 rounded-md text-xs font-medium">
                {tag}
              </span>
            ))}
            <span>•</span>
            <span>{episodes?.length || 0} Episodes</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6">
        {/* Creator Info */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 relative">
              <img 
                src={series.creatorAvatarUrl || series.creatorProfilePic || '/avatars/avatar.png'} 
                alt="Creator" 
                className="w-full h-full object-cover" 
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== '/avatars/avatar.png') {
                    target.src = '/avatars/avatar.png';
                  }
                }}
              />
            </div>
            <div>
              <p className="font-semibold text-white">{series.creatorName || "Creator"}</p>
              <p className="text-xs text-gray-400">@{series.creatorHandle || "creator"}</p>
            </div>
          </div>
          <button
            onClick={handleFollow}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              isFollowing 
                ? "bg-white/10 text-white border border-white/20" 
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isFollowing ? (
              <><Check className="w-4 h-4" /> Following</>
            ) : (
              <><Plus className="w-4 h-4" /> Follow</>
            )}
          </button>
        </div>

        {/* Description */}
        <div>
          <p className={`text-gray-300 text-sm leading-relaxed ${!showFullDesc && "line-clamp-3"}`}>
            {series.description || "No description provided."}
          </p>
          {(series.description?.length > 150) && (
            <button 
              onClick={() => setShowFullDesc(!showFullDesc)}
              className="text-red-400 text-sm font-medium mt-1 hover:text-red-300 transition-colors"
            >
              {showFullDesc ? "Read less" : "Read more"}
            </button>
          )}
        </div>

        {/* Primary Action */}
        {nextEpisode && (
          <Link
            href={`/raftaar-films/${series.seriesId}/${nextEpisode.videoId}`}
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white py-3.5 rounded-xl font-bold text-lg transition-transform active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          >
            <Play className="w-5 h-5 fill-current" />
            Watch Episode 1
          </Link>
        )}

        {/* Episodes Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Episodes</h2>
            <span className="text-sm text-gray-400">Total {episodes?.length || 0}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {episodes?.map((ep: any, index: number) => {
              const thumbSrc = ep.thumbnailUrl || series.posterUrl || '/placeholder-vertical.svg';
              return (
                <Link 
                  key={ep.videoId}
                  href={`/raftaar-films/${series.seriesId}/${ep.videoId}`}
                  className="group relative rounded-xl overflow-hidden aspect-[9/16] border border-white/5 bg-gray-900 transition-transform active:scale-95 hover:border-white/20"
                >
                  <img 
                    src={thumbSrc}
                    alt={ep.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== '/placeholder-vertical.svg') {
                        target.src = '/placeholder-vertical.svg';
                      }
                    }}
                  />
                  
                  {/* Overlay details */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-semibold">
                      Ep {ep.episodeNumber || index + 1}
                    </div>
                    <h3 className="text-sm font-semibold text-white line-clamp-2 leading-tight">
                      {ep.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-300 mt-1">
                      <span>{ep.views || ep.viewCount || 0} views</span>
                    </div>
                  </div>
                </Link>
              );
            })}
            
            {(!episodes || episodes.length === 0) && (
              <div className="col-span-2 sm:col-span-3 text-center py-10 text-gray-500 bg-white/5 rounded-xl">
                No episodes available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
