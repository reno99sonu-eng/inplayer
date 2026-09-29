"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, Share2, Plus, Heart, MessageCircle, Bookmark, 
  MoreVertical, Play, Pause, ListVideo, X
} from "lucide-react";

export default function FilmPlayerContent({ series, episodes, currentEpisodeId, user }: any) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Find current index
  const currentIndex = episodes?.findIndex((ep: any) => ep.videoId === currentEpisodeId) ?? 0;
  const currentEpisode = episodes?.[currentIndex];
  
  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;
  const nextEpisode = currentIndex < (episodes?.length - 1) ? episodes[currentIndex + 1] : null;

  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showEpisodesList, setShowEpisodesList] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(currentEpisode?.likeCount || 0);

  useEffect(() => {
    // Reset state when episode changes
    setIsPlaying(true);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.log("Autoplay prevented:", e));
    }
  }, [currentEpisodeId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (prevEpisode) router.push(`/raftaar-films/${series.seriesId}/${prevEpisode.videoId}`);
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (nextEpisode) router.push(`/raftaar-films/${series.seriesId}/${nextEpisode.videoId}`);
      } else if (e.key === ' ') {
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevEpisode, nextEpisode, series.seriesId, router]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(progress);
    }
  };

  const handleVideoEnded = () => {
    if (nextEpisode) {
      router.push(`/raftaar-films/${series.seriesId}/${nextEpisode.videoId}`);
    }
  };

  const handleLike = async () => {
    setIsLiked(!isLiked);
    setLikeCount((prev: number) => isLiked ? prev - 1 : prev + 1);
    // In real app, call /api/likes
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: currentEpisode?.title || series.title,
        url: window.location.href,
      });
    }
  };

  if (!currentEpisode) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Episode not found</div>;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col md:max-w-md md:mx-auto relative overflow-hidden">
      
      {/* Video Background */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900" onClick={togglePlay}>
        {currentEpisode.videoUrl ? (
          <video
            ref={videoRef}
            src={currentEpisode.videoUrl}
            className="w-full h-full object-cover"
            playsInline
            loop={false}
            autoPlay
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-gray-800 to-black flex items-center justify-center text-gray-500">
            [Video Player Placeholder]
          </div>
        )}
      </div>

      {/* Play/Pause Overlay Icon (shows briefly) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="absolute top-0 w-full p-4 flex items-center justify-between z-30 bg-gradient-to-b from-black/70 to-transparent pt-safe">
        <button onClick={() => router.push(`/raftaar-films/${series.seriesId}`)} className="p-2 -ml-2 rounded-full active:bg-white/10">
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        <button 
          onClick={() => setShowEpisodesList(true)}
          className="flex flex-col items-center flex-1 mx-4"
        >
          <span className="text-sm font-semibold opacity-90 drop-shadow-md line-clamp-1">{series.title}</span>
          <div className="flex items-center gap-1 text-xs opacity-70 bg-white/10 px-2 py-0.5 rounded-full mt-1 backdrop-blur-md">
            <ListVideo className="w-3 h-3" />
            <span>Ep {currentEpisode.episodeNumber} / {episodes.length} <ChevronLeft className="w-3 h-3 inline rotate-[-90deg]" /></span>
          </div>
        </button>

        <button className="p-2 -mr-2 rounded-full active:bg-white/10">
          <MoreVertical className="w-6 h-6" />
        </button>
      </div>

      {/* Right Action Rail */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-30">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={handleLike}
            className={`w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border ${isLiked ? 'border-red-500 bg-red-500/20' : 'border-white/10'} transition-transform active:scale-90`}
          >
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </button>
          <span className="text-xs font-semibold drop-shadow-md">{likeCount || 'Like'}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10 transition-transform active:scale-90">
            <MessageCircle className="w-6 h-6 text-white" />
          </button>
          <span className="text-xs font-semibold drop-shadow-md">{currentEpisode.commentCount || 'Comment'}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={() => setIsSaved(!isSaved)}
            className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10 transition-transform active:scale-90"
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-white text-white' : 'text-white'}`} />
          </button>
          <span className="text-xs font-semibold drop-shadow-md">Save</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={handleShare}
            className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10 transition-transform active:scale-90"
          >
            <Share2 className="w-6 h-6 text-white" />
          </button>
          <span className="text-xs font-semibold drop-shadow-md">Share</span>
        </div>
      </div>

      {/* Bottom Info Overlay */}
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/60 to-transparent p-4 pb-8 z-20">
        
        {/* Creator Profile */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700 border border-white/20">
              {series.creatorProfilePic ? (
                <Image src={series.creatorProfilePic} alt="Creator" fill className="object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-sm font-bold">
                  {series.creatorName?.[0] || "C"}
                </div>
              )}
            </div>
            {!isFollowing && (
              <button 
                onClick={() => setIsFollowing(true)}
                className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5 border border-black"
              >
                <Plus className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight drop-shadow-md">@{series.creatorHandle || "creator"}</p>
          </div>
        </div>

        {/* Title */}
        <div className="pr-20 mb-2">
          <div className="inline-block bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold mb-1 uppercase tracking-wider text-red-100 border border-white/10">
            Episode {currentEpisode.episodeNumber}
          </div>
          <h2 className="text-base font-medium line-clamp-2 drop-shadow-md">{currentEpisode.title}</h2>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-40 cursor-pointer">
        <div 
          className="h-full bg-red-500 relative" 
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow" />
        </div>
      </div>

      {/* Episodes Drawer/Modal */}
      {showEpisodesList && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#1C1C1E] h-[60vh] rounded-t-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Episodes</h3>
                <p className="text-xs text-gray-400">{series.title}</p>
              </div>
              <button onClick={() => setShowEpisodesList(false)} className="p-2 bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 gap-2">
                {episodes.map((ep: any) => (
                  <Link
                    key={ep.videoId}
                    href={`/raftaar-films/${series.seriesId}/${ep.videoId}`}
                    onClick={() => setShowEpisodesList(false)}
                    className={`aspect-square flex items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                      ep.videoId === currentEpisodeId 
                        ? 'bg-red-500 text-white' 
                        : 'bg-white/5 hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {ep.episodeNumber}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
