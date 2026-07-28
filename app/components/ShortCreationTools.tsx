"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { searchSoundtracks } from "@/app/data/soundtracks";

export interface ShortSettings {
  soundtrackId: string | null;
  musicClipSeconds: 20 | 30;
  filter: "original" | "warm" | "vivid" | "mono";
}

// Soundtrack picker, clip length, look filter, and the AI-assist entry
// point for Shorts creation. The catalog itself lives in
// app/data/soundtracks.ts (shared with actual Shorts playback in
// ShortsPageContent.tsx) so a track chosen here is guaranteed to be the
// same one that plays back later — previously this picker only stored an
// {id, title, artist} triple with no real audio behind it at all.
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

  const results = searchSoundtracks(query);

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
            Original sound collection
          </p>
          {value.soundtrackId && (
            <button
              type="button"
              onClick={() => onChange({ ...value, soundtrackId: null })}
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
          placeholder="Search by title, artist, or mood (e.g. chill, upbeat)"
          className="mt-2 w-full rounded-xl border border-white/10 light:border-black/10 bg-[#07111F] light:bg-black/[0.03] px-3 py-2 text-xs text-white light:text-slate-900 outline-none focus:border-orange-400/50"
        />

        <div className="mt-2 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {results.length === 0 ? (
            <p className="col-span-full py-3 text-center text-xs text-slate-500">
              No sounds match &quot;{query}&quot;.
            </p>
          ) : (
            results.map((track) => {
              const selected = value.soundtrackId === track.id;
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
                    onClick={() => onChange({ ...value, soundtrackId: selected ? null : track.id })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-xs font-bold text-white light:text-slate-900">
                      {track.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400 light:text-slate-600">
                      {track.artist} · {track.mood}
                    </p>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          Every track is an original InPlayer instrumental — safe to use, no
          licensing needed. Clips play for {value.musicClipSeconds} seconds.
        </p>
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
