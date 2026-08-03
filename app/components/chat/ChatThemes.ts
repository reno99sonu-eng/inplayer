export interface ChatTheme {
  id: string;
  name: string;
  previewBg: string;
  containerClass: string;
  bubbleMine: string;
  bubbleOther: string;
  wallpaperPatternSvg?: string;
}

export const CHAT_THEMES: Record<string, ChatTheme> = {
  default: {
    id: "default",
    name: "Obsidian Amber Glass",
    previewBg: "bg-[#060D17] border-orange-500/50",
    containerClass: "bg-[#060D17] text-white",
    bubbleMine: "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-slate-950 font-semibold shadow-lg shadow-orange-500/20",
    bubbleOther: "border border-white/10 bg-[#0E1A2B] text-slate-100 shadow-md",
  },
  emerald: {
    id: "emerald",
    name: "WhatsApp Signature Emerald",
    previewBg: "bg-[#0B141A] border-emerald-500",
    containerClass: "bg-[#0B141A] text-white",
    bubbleMine: "bg-[#005C4B] text-white shadow-md border border-emerald-500/30",
    bubbleOther: "bg-[#202C33] text-slate-100 shadow-md border border-white/10",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon Grid",
    previewBg: "bg-[#070214] border-cyan-400",
    containerClass: "bg-[#070214] text-cyan-100",
    bubbleMine: "bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] border border-cyan-300/40 font-semibold",
    bubbleOther: "border border-cyan-500/30 bg-[#12082A] text-cyan-100 shadow-lg",
  },
  midnight: {
    id: "midnight",
    name: "Midnight Galaxy Stars",
    previewBg: "bg-[#0A071B] border-purple-500",
    containerClass: "bg-[#0A071B] text-purple-100",
    bubbleMine: "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 text-white shadow-lg border border-purple-400/30 font-semibold",
    bubbleOther: "border border-purple-500/20 bg-[#150F2E] text-purple-100 shadow-md",
  },
  sunset: {
    id: "sunset",
    name: "Warm Gold Sunset",
    previewBg: "bg-[#160B04] border-amber-500",
    containerClass: "bg-[#160B04] text-amber-100",
    bubbleMine: "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-semibold shadow-lg shadow-orange-500/20 border border-amber-300/40",
    bubbleOther: "border border-amber-500/25 bg-[#261308] text-amber-100 shadow-md",
  },
  minimal: {
    id: "minimal",
    name: "Slate Monochrome",
    previewBg: "bg-[#0B1220] border-slate-500",
    containerClass: "bg-[#0B1220] text-slate-100",
    bubbleMine: "bg-[#1D4ED8] text-white font-medium shadow-md border border-blue-400/30",
    bubbleOther: "bg-[#1E293B] text-slate-200 shadow-md border border-slate-700/60",
  },
};
