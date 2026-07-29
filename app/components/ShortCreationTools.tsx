"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Music2, Pause, Play, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { searchSoundtracks, toResolvedSoundtrack, ResolvedSoundtrack } from "@/app/data/soundtracks";

export interface ShortSettings {
  soundtrack: ResolvedSoundtrack | null;
  musicClipSeconds: 20 | 30;
  filter: "original" | "warm" | "vivid" | "mono";
}

// Soundtrack picker, clip length, look filter, and the AI-assist entry
// point for Shorts creation. Two catalogs feed the same picker: InPlayer's
// own local instrumentals (app/data/soundtracks.ts — 100% synthesized, no
// licensing needed at all) and a live search against real Creative
// Commons music via Jamendo (app/api/music/search) — the "works now, real
// commercial licensing later" stopgap. Whichever is picked gets stored in
// full (id/title/artist/url/duration/source), not just an id, so
// ShortsPageContent.tsx never has to re-look-up an external track to play
// a published Short back.
export default function ShortCreationTools({
  value,
  onChange,
  onOpenAI,
}: {
  value: ShortSettings;
  onChange: (value: ShortSettings) => void;
  onOpenAI: () => void;
}) {
  const [query, setQuery] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const localResults = searchSoundtracks(query).map(toResolvedSoundtrack);

  const [jamendoResults, setJamendoResults] = useState<ResolvedSoundtrack[]>([]);
  const [jamendoLoading, setJamendoLoading] = useState(false);
  const [jamendoError, setJamendoError] = useState<string | null>(null);

  const trimmedQuery = query.trim();

  // Debounced live search against real music — only once there's an
  // actual query, so the picker doesn't fire a network request on every
  // page load just to show the (already-instant) local catalog. When the
  // query is cleared, the effect just does nothing further (no setState)
  // — any stale jamendoResults/jamendoLoading/jamendoError from a previous
  // search are gated out below by trimmedQuery instead of being reset
  // here, so clearing the box can't flash a stray "couldn't search" error
  // or spinner from the last search.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      // Loading/error state only flips once the debounce actually elapses
      // and a real request is about to go out — not the instant a
      // keystroke lands — so these live inside the timer callback rather
      // than synchronously in the effect body.
      setJamendoLoading(true);
      setJamendoError(null);
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setJamendoError(data.error || "Couldn't search real music right now.");
          setJamendoResults([]);
        } else {
          setJamendoResults(Array.isArray(data.tracks) ? data.tracks : []);
        }
      } catch (err) {
        console.error("Music search failed:", err);
        if (!cancelled) {
          setJamendoError("Couldn't search real music right now.");
          setJamendoResults([]);
        }
      } finally {
        if (!cancelled) setJamendoLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const results = [...localResults, ...(trimmedQuery ? jamendoResults : [])];
  const showJamendoLoading = trimmedQuery && jamendoLoading;
  const showJamendoError = trimmedQuery ? jamendoError : null;

  // Stop any preview if the creator navigates away mid-upload.
  useEffect(() => {
    const audio = previewAudioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  const togglePreview = (trackId: string, url: string) => {
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (previewingId === trackId) {
      audio.pause();
      setPreviewingId(null);
      return;
    }

    audio.src = url;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Blocked-autoplay rejection can't actually happen off a direct click
      // like this one, but fail quietly rather than throw either way.
    });
    setPreviewingId(trackId);
  };

  return (
    <section className="rounded-3xl border border-orange-400/20 bg-orange-500/[0.04] p-4 sm:p-5">
      <audio ref={previewAudioRef} onEnded={() => setPreviewingId(null)} className="hidden" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-white light:text-slate-900">
            <Music2 size={17} className="text-orange-400" />
            Short creation tools
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400 light:text-slate-600">
            Choose a soundtrack clip, a look, or start an AI-assisted idea.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAI}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20 light:text-violet-700"
        >
          <Sparkles size={14} />
          Create with AI
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">
            Sound collection
          </p>
          {value.soundtrack && (
            <button
              type="button"
              onClick={() => onChange({ ...value, soundtrack: null })}
              className="text-[11px] font-semibold text-orange-300 hover:text-orange-200"
            >
              Clear
            </button>
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search InPlayer Sounds, or type a song/artist to find real music"
          className="mt-2 w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-orange-400/50"
        />

        <div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {results.length === 0 ? (
            showJamendoLoading ? (
              <p className="col-span-full flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
                <Loader2 size={13} className="animate-spin" /> Searching…
              </p>
            ) : (
              <p className="col-span-full py-3 text-center text-xs text-slate-500">
                No sounds match &quot;{query}&quot;.
              </p>
            )
          ) : (
            results.map((track) => {
              const selected = value.soundtrack?.id === track.id;
              const previewing = previewingId === track.id;
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-2 rounded-2xl border p-3 transition ${
                    selected
                      ? "border-orange-400/60 bg-orange-500/15"
                      : "border-white/10 bg-white/[.03] hover:border-orange-400/30 light:border-black/10"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePreview(track.id, track.url)}
                    aria-label={previewing ? `Pause preview of ${track.title}` : `Preview ${track.title}`}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 light:bg-black/10 light:text-slate-900"
                  >
                    {previewing ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...value, soundtrack: selected ? null : track })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-bold text-white light:text-slate-900">
                      {track.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-400 light:text-slate-600">
                      <span className="truncate">{track.artist}</span>
                      <span
                        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                          track.source === "jamendo"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-orange-500/15 text-orange-300"
                        }`}
                      >
                        {track.source === "jamendo" ? "CC music" : "InPlayer"}
                      </span>
                    </p>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {showJamendoError && (
          <p className="mt-2 text-[11px] text-red-300">{showJamendoError}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-300 light:text-slate-700">Music clip</span>
        {([20, 30] as const).map((seconds) => (
          <button
            key={seconds}
            type="button"
            onClick={() => onChange({ ...value, musicClipSeconds: seconds })}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              value.musicClipSeconds === seconds
                ? "bg-orange-500 text-white"
                : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
            }`}
          >
            {seconds}s
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">
          <SlidersHorizontal size={14} />
          Look
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["original", "warm", "vivid", "mono"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => onChange({ ...value, filter })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${
                value.filter === filter
                  ? "bg-white text-slate-900 light:bg-slate-900 light:text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs text-slate-400 light:border-black/10 light:bg-white/40 light:text-slate-600">
        <Wand2 size={15} className="shrink-0 text-orange-400" />
        Soundtrack and look selections are saved with the Short and play back
        automatically in the Shorts feed.
      </div>
    </section>
  );
}
