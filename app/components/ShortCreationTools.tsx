"use client";

import { Music2, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";

const SOUNDTRACKS = [
  { id: "sunset-drive", title: "Sunset Drive", artist: "InPlayer Sounds" },
  { id: "late-night", title: "Late Night Loop", artist: "InPlayer Sounds" },
  { id: "bright-day", title: "Bright Day", artist: "InPlayer Sounds" },
];

export interface ShortSettings {
  soundtrackId: string | null;
  musicClipSeconds: 20 | 30;
  filter: "original" | "warm" | "vivid" | "mono";
}

export default function ShortCreationTools({ value, onChange, onOpenAI }: { value: ShortSettings; onChange: (value: ShortSettings) => void; onOpenAI: () => void }) {
  return <section className="rounded-3xl border border-orange-400/20 bg-orange-500/[0.04] p-4 sm:p-5">
    <div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-black text-white light:text-slate-900"><Music2 size={17} className="text-orange-400" />Short creation tools</p><p className="mt-1 text-xs leading-5 text-slate-400 light:text-slate-600">Choose a soundtrack clip, a look, or start an AI-assisted idea.</p></div><button type="button" onClick={onOpenAI} className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-200 transition hover:bg-violet-500/20 light:text-violet-700"><Sparkles size={14} />Create with AI</button></div>
    <div className="mt-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600">Licensed sound collection</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{SOUNDTRACKS.map((track) => <button key={track.id} type="button" onClick={() => onChange({ ...value, soundtrackId: value.soundtrackId === track.id ? null : track.id })} className={`rounded-2xl border p-3 text-left transition ${value.soundtrackId === track.id ? "border-orange-400/60 bg-orange-500/15" : "border-white/10 bg-white/[.03] hover:border-orange-400/30 light:border-black/10"}`}><p className="text-xs font-bold text-white light:text-slate-900">{track.title}</p><p className="mt-1 text-[11px] text-slate-400 light:text-slate-600">{track.artist}</p></button>)}</div><p className="mt-2 text-[11px] text-slate-500">Sound choices are limited to 20 or 30-second clips. Only use audio you have the rights to use; this UI does not clear third-party audio.</p></div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-slate-300 light:text-slate-700">Music clip</span>{([20, 30] as const).map((seconds) => <button key={seconds} type="button" onClick={() => onChange({ ...value, musicClipSeconds: seconds })} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${value.musicClipSeconds === seconds ? "bg-orange-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"}`}>{seconds}s</button>)}</div>
    <div className="mt-4"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-slate-400 light:text-slate-600"><SlidersHorizontal size={14} />Look</p><div className="mt-2 flex flex-wrap gap-2">{(["original", "warm", "vivid", "mono"] as const).map((filter) => <button key={filter} type="button" onClick={() => onChange({ ...value, filter })} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${value.filter === filter ? "bg-white text-slate-900 light:bg-slate-900 light:text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 light:bg-black/5"}`}>{filter}</button>)}</div></div>
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/10 p-3 text-xs text-slate-400 light:border-black/10 light:bg-white/40 light:text-slate-600"><Wand2 size={15} className="shrink-0 text-orange-400" />Soundtrack and look selections are saved with the Short for the publishing pipeline.</div>
  </section>;
}
