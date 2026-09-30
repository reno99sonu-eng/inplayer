'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FilmSeries } from '@/app/lib/raftaarFilms';
import GenreBar from './GenreBar';
import CreatorStoryStrip, { TopCreator } from './CreatorStoryStrip';
import SeriesGrid from './SeriesGrid';
import RaftaarFilmsIntro from './RaftaarFilmsIntro';
import { ArrowLeft, Film, Upload, Search, X, Mic } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthModal } from '@/app/components/auth/AuthProvider';
import { fetchAuthSession } from 'aws-amplify/auth';
import './RaftaarFilms3DStyles.css';

export default function RaftaarFilmsLanding() {
  const [series, setSeries] = useState<FilmSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  
  const router = useRouter();
  const { signedIn, openSignIn } = useAuthModal();
  const [isApproved, setIsApproved] = useState(false);
  const [appStatus, setAppStatus] = useState<string>("none");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [supportSpeech, setSupportSpeech] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        setSupportSpeech(false);
      }
    }
  }, []);

  useEffect(() => {
    if (searchOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [searchOpen]);

  const toggleSpeech = () => {
    if (isListening) return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setSearchQuery(transcript);
        }
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const seriesRes = await fetch('/api/raftaar-films/series').then(r => r.json());
        if (seriesRes.series) setSeries(seriesRes.series);
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

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* 3D Liquid Glass Intro Overlay (when triggered via ?intro=1) */}
      {showIntro && (
        <RaftaarFilmsIntro onComplete={() => setShowIntro(false)} />
      )}

      {/* Dedicated Compact Raftaar Films Header */}
      <header className="sticky top-0 z-40 bg-black/85 backdrop-blur-2xl border-b border-white/[0.08] px-3 sm:px-6 py-2.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Back button + Raftaar Films Title with 3D Animated Liquid Glass Icon */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
            <Link
              href="/"
              aria-label="Back"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/[0.12] text-zinc-300 hover:text-white transition-all backdrop-blur-md active:scale-95 shadow-sm shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="rf-liquid-glass-badge shrink-0">
                <Film className="w-3.5 h-3.5 text-white drop-shadow" />
              </div>
              <span className="font-extrabold text-xs sm:text-sm md:text-base tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent select-none whitespace-nowrap truncate">
                Raftaar Films
              </span>
            </div>
          </div>

          {/* Right: Search magnifying glass beside Upload/Apply button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Magnifying Glass Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Toggle search"
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95 cursor-pointer ${
                searchOpen || searchQuery
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(249,115,22,0.5)] border border-amber-300/60"
                  : "bg-white/[0.08] hover:bg-white/[0.18] border border-white/[0.12] text-zinc-300 hover:text-white"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {isApproved ? (
              <>
                <Link
                  href="/my-videos?tab=raftaar-films"
                  className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-200 hover:text-white transition-all"
                >
                  Studio
                </Link>
                <Link
                  href="/upload?type=film"
                  className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 hover:from-orange-400 hover:to-yellow-300 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.4)] transition-all hover:scale-105 active:scale-95"
                >
                  <Upload className="w-3 h-3 stroke-[2.5]" />
                  <span>Upload</span>
                </Link>
              </>
            ) : appStatus === "pending" ? (
              <Link
                href="/raftaar-films/apply"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] sm:text-[11px] font-semibold hover:bg-amber-500/25 transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden sm:inline">Under Review</span>
                <span className="sm:hidden">Reviewing</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!signedIn) {
                    openSignIn();
                  } else {
                    router.push("/raftaar-films/apply");
                  }
                }}
                className="text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-[0_0_12px_rgba(234,88,12,0.35)] transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
              >
                <span className="hidden xs:inline">Apply as Creator</span>
                <span className="xs:hidden">Apply</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Search Input (Opened via Magnifying Glass) */}
        {searchOpen && (
          <div className="max-w-2xl mx-auto pt-2.5 transition-all">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-3.5 h-3.5 text-orange-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search micro-series, creators..."
                className="w-full bg-white/[0.07] hover:bg-white/[0.1] focus:bg-white/[0.12] border border-white/15 focus:border-orange-500/60 rounded-full pl-9 pr-20 py-1.5 text-xs text-white placeholder-zinc-400 outline-none transition-all shadow-inner"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                {supportSpeech && (
                  <button
                    type="button"
                    onClick={toggleSpeech}
                    title="Search by voice"
                    className={`p-1.5 rounded-full transition-all ${
                      isListening
                        ? "bg-orange-500/25 text-orange-400 animate-pulse"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="px-2 py-0.5 text-zinc-400 hover:text-white text-[11px] font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-1 relative z-20">
        {/* Creators Avatar Strip at the very top */}
        <CreatorStoryStrip 
          creators={topCreators} 
          selectedCreatorId={selectedCreatorId}
          onSelectCreator={setSelectedCreatorId}
        />

        {/* Scrolling categories just below creators */}
        <GenreBar selectedGenre={selectedGenre} onSelectGenre={setSelectedGenre} />

        {/* Series Section & Grid */}
        <div className="mt-3 mb-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              {searchQuery ? (
                <>
                  <span>Search:</span>
                  <span className="text-orange-400 font-semibold truncate max-w-[200px]">"{searchQuery}"</span>
                </>
              ) : selectedCreatorId ? (
                'Creator Stories'
              ) : selectedGenre !== 'All' ? (
                `${selectedGenre} Series`
              ) : (
                'Explore Micro-Series'
              )}
            </h2>
            <span className="text-xs text-zinc-400 font-medium">{filteredSeries.length} series</span>
          </div>
          
          <SeriesGrid series={filteredSeries} loading={loading} />
        </div>

        {/* Apply as Creator / Upload Banner (Compact and Tightened) */}
        <div className="mt-8 bg-gradient-to-br from-zinc-900/90 to-zinc-950 border border-white/10 rounded-2xl p-5 sm:p-7 text-center relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all pointer-events-none"></div>
          
          <h2 className="text-lg sm:text-xl font-black mb-1.5 relative z-10 text-white tracking-tight">
            {isApproved ? "Ready to Publish Your Next Episode?" : "Got a Micro-Drama Story to Tell?"}
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto mb-4 relative z-10 leading-relaxed">
            {isApproved
              ? "Your creator account is approved. Create new series, upload vertical episodes, and share your storytelling."
              : "Join Raftaar Films to showcase vertical micro-dramas to thousands of viewers and build your In-Family community."}
          </p>
          <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
            {isApproved ? (
              <>
                <Link
                  href="/upload?type=film"
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 text-slate-950 px-5 py-2.5 rounded-full font-black text-xs hover:scale-105 transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                >
                  <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Upload Episode</span>
                </Link>
                <Link
                  href="/my-videos?tab=raftaar-films"
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-full font-bold text-xs transition-all"
                >
                  Series Studio
                </Link>
              </>
            ) : appStatus === "pending" ? (
              <Link
                href="/raftaar-films/apply"
                className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 px-5 py-2.5 rounded-full font-bold text-xs hover:bg-amber-500/30 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Application Under Review (48-72 hrs)
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!signedIn) {
                      openSignIn();
                    } else {
                      router.push("/raftaar-films/apply");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 px-5 py-2.5 rounded-full font-black text-xs hover:scale-105 transition-all shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                >
                  Apply as Creator
                </button>
                <div className="w-full mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Fast-track review within 48-72 hrs
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
