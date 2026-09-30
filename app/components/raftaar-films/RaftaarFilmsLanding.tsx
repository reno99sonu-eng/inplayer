'use client';

import React, { useState, useEffect } from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import FilmSearchBar from './FilmSearchBar';
import GenreBar from './GenreBar';
import CreatorStoryStrip, { TopCreator } from './CreatorStoryStrip';
import SeriesGrid from './SeriesGrid';
import { Play, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function RaftaarFilmsLanding() {
  const [series, setSeries] = useState<FilmSeries[]>([]);
  const [trending, setTrending] = useState<FilmSeries[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);

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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-4 shadow-2xl mb-8">
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

        {/* Apply as Creator Banner */}
        <div className="mt-16 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700/50 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/20 transition-all"></div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-4 relative z-10">Got a Story to Tell?</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto mb-8 relative z-10">
            Join Raftaar Films as a creator and bring your micro-drama series to millions of viewers. Share your content and build a dedicated fanbase from day one.
          </p>
          <div className="relative z-10">
            <Link href="/raftaar-films/apply" className="inline-block bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-zinc-200 transition-colors">
              Apply as Creator
            </Link>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-zinc-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Fast-track approval within 48-72 hrs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
