'use client';

import React, { useState, useEffect } from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import FilmSearchBar from './FilmSearchBar';
import GenreBar from './GenreBar';
import CreatorStoryStrip, { TopCreator } from './CreatorStoryStrip';
import SeriesGrid from './SeriesGrid';
import RaftaarFilmsIntro from './RaftaarFilmsIntro';
import { Play, Sparkles, ArrowLeft, Film, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthModal } from '@/app/components/auth/AuthProvider';
import { fetchAuthSession } from 'aws-amplify/auth';

export default function RaftaarFilmsLanding() {
  const [series, setSeries] = useState<FilmSeries[]>([]);
  const [trending, setTrending] = useState<FilmSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  
  const router = useRouter();
  const { signedIn, openSignIn } = useAuthModal();
  const [isApproved, setIsApproved] = useState(false);
  const [appStatus, setAppStatus] = useState<string>("none");

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    async function checkApproval() {
      if (!signedIn) {
        setIsApproved(false);
        setAppStatus("none");
        return;
      }
      try {
        const session = await fetchAuthSession().catch(() => null);
        const token = session?.tokens?.idToken?.toString();
        if (!token || canceled) return;

        const res = await fetch("/api/raftaar-films/apply", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !canceled) {
          const data = await res.json();
          if (data.isApproved || data.status === "approved" || data.application?.status === "approved") {
            setIsApproved(true);
            setAppStatus("approved");
          } else if (data.status === "pending" || data.application?.status === "pending") {
            setIsApproved(false);
            setAppStatus("pending");
          } else {
            setIsApproved(false);
            setAppStatus("none");
          }
        }
      } catch (err) {
        console.error("Error checking creator approval:", err);
      }
    }
    checkApproval();
    return () => {
      canceled = true;
    };
  }, [signedIn]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('intro') === '1') {
        setShowIntro(true);
      }
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [seriesRes, trendingRes] = await Promise.all([
          fetch('/api/raftaar-films/series').then(r => r.json()),
          fetch('/api/raftaar-films/trending').then(r => r.json())
        ]);
        
        if (seriesRes.series) setSeries(seriesRes.series);
        if (trendingRes.series) setTrending(trendingRes.series);
      } catch (err) {
        console.error("Error fetching raftaar films data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const creatorsMap = new Map<string, TopCreator>();
  series.forEach(s => {
    if (!creatorsMap.has(s.creatorId)) {
      creatorsMap.set(s.creatorId, {
        creatorId: s.creatorId,
        name: s.creatorName,
        avatarUrl: s.creatorAvatarUrl || '/default-avatar.png'
      });
    }
  });
  const topCreators = Array.from(creatorsMap.values()).slice(0, 10);

  const filteredSeries = series.filter(s => {
    if (selectedGenre !== 'All' && s.genre !== selectedGenre) return false;
    if (selectedCreatorId && s.creatorId !== selectedCreatorId) return false;
    if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase()) && !s.creatorName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const heroSeries = trending.length > 0 ? trending[0] : null;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* 3D Liquid Glass Intro Overlay (when triggered via ?intro=1) */}
      {showIntro && (
        <RaftaarFilmsIntro onComplete={() => setShowIntro(false)} />
      )}

      {/* Dedicated Isolated Raftaar Films Header */}
      <header className="sticky top-0 z-40 bg-black/60 backdrop-blur-2xl border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-zinc-300 hover:text-white transition-all backdrop-blur-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>InPlayer</span>
            </Link>
            <div className="h-4 w-[1px] bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_12px_rgba(249,115,22,0.4)]">
                <Film className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
                Raftaar Films
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isApproved ? (
              <>
                <Link
                  href="/my-videos?tab=raftaar-films"
                  className="hidden sm:inline-flex text-xs font-bold px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-200 hover:text-white transition-all"
                >
                  Series Studio
                </Link>
                <Link
                  href="/upload?type=film"
                  className="inline-flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-slate-950 shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all hover:scale-105"
                >
                  <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Upload</span>
                </Link>
              </>
            ) : appStatus === "pending" ? (
              <Link
                href="/raftaar-films/apply"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Under Review (48-72h)</span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  if (!signedIn) {
                    openSignIn();
                  } else {
                    router.push("/raftaar-films/apply");
                  }
                }}
                className="text-xs font-bold px-4 py-2 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.35)] transition-all hover:scale-105"
              >
                Apply as Creator
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      {heroSeries && (
        <div className="relative w-full h-[60vh] md:h-[70vh] flex items-end">
          <div className="absolute inset-0">
            <img src={heroSeries.bannerUrl || heroSeries.posterUrl} alt={heroSeries.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
          </div>
          <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <span className="text-orange-500 font-bold tracking-widest uppercase text-sm">#1 Trending Micro-Series</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold mb-4 drop-shadow-lg">{heroSeries.title}</h1>
            <p className="text-zinc-300 max-w-2xl mb-6 line-clamp-2 md:text-lg">{heroSeries.description}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href={`/raftaar-films/${heroSeries.seriesId}`} className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-8 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(234,88,12,0.4)] hover:scale-105">
                <Play className="w-5 h-5 fill-current" />
                Watch Now
              </Link>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-3 rounded-full text-sm font-medium">
                {heroSeries.episodeCount} Episodes
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${heroSeries ? '-mt-6' : 'pt-8'} relative z-20`}>
        <div className="mb-8">
          <FilmSearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        <CreatorStoryStrip 
          creators={topCreators} 
          selectedCreatorId={selectedCreatorId}
          onSelectCreator={setSelectedCreatorId}
        />

        <GenreBar selectedGenre={selectedGenre} onSelectGenre={setSelectedGenre} />

        <div className="mt-6 mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">
              {searchQuery ? 'Search Results' : selectedCreatorId ? 'Creator Stories' : selectedGenre !== 'All' ? `${selectedGenre} Series` : 'Explore Raftaar Films'}
            </h2>
            <span className="text-zinc-400 text-sm">{filteredSeries.length} results</span>
          </div>
          
          <SeriesGrid series={filteredSeries} loading={loading} />
        </div>

        {/* Apply as Creator / Upload Banner */}
        <div className="mt-16 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700/50 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/20 transition-all"></div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-4 relative z-10">
            {isApproved ? "Ready to Publish Your Next Episode?" : "Got a Story to Tell?"}
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto mb-8 relative z-10">
            {isApproved
              ? "Your Raftaar Films creator account is approved! Create new series, upload vertical episodes, and share your storytelling with thousands of daily viewers."
              : "Join Raftaar Films as a creator and bring your micro-drama series to millions of viewers. Share your content and build a dedicated fanbase from day one."}
          </p>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
            {isApproved ? (
              <>
                <Link
                  href="/upload?type=film"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-slate-950 px-8 py-4 rounded-full font-black text-sm hover:scale-105 transition-all shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                >
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                  <span>Upload Episode</span>
                </Link>
                <Link
                  href="/my-videos?tab=raftaar-films"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-4 rounded-full font-bold text-sm transition-all"
                >
                  Series Studio
                </Link>
              </>
            ) : appStatus === "pending" ? (
              <Link
                href="/raftaar-films/apply"
                className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-8 py-4 rounded-full font-bold text-sm hover:bg-amber-500/30 transition-all"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                Application Under Review (48-72 hrs)
              </Link>
            ) : (
              <>
                <button
                  onClick={() => {
                    if (!signedIn) {
                      openSignIn();
                    } else {
                      router.push("/raftaar-films/apply");
                    }
                  }}
                  className="inline-block bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-colors"
                >
                  Apply as Creator
                </button>
                <div className="w-full mt-2 flex items-center justify-center gap-2 text-sm text-zinc-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  Fast-track approval within 48-72 hrs
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
