export interface ChatTheme {
  id: string;
  name: string;
  previewBg: string;
  containerClass: string;
  bubbleMine: string;
  bubbleOther: string;
}

export const CHAT_THEMES: Record<string, ChatTheme> = {
  default: {
    id: "default",
    name: "Obsidian Glass (Default)",
    previewBg: "bg-slate-900 border-slate-700",
    containerClass: "bg-[#06101D] light:bg-[#FAF5E9]",
    bubbleMine: "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-white shadow-lg",
    bubbleOther: "border border-white/10 light:border-black/10 bg-white/[0.05] light:bg-slate-100 text-slate-100 light:text-slate-900 shadow-sm",
  },
  emerald: {
    id: "emerald",
    name: "WhatsApp Emerald Pattern",
    previewBg: "bg-[#0B141A] border-emerald-600",
    containerClass: "bg-[#0B141A] light:bg-[#E5DDD5] bg-[radial-gradient(#054640_1px,transparent_1px)] [background-size:16px_16px]",
    bubbleMine: "bg-[#005C4B] text-white shadow-md border border-emerald-500/20",
    bubbleOther: "bg-[#202C33] light:bg-white text-slate-100 light:text-slate-900 shadow-md border border-white/5",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon Glow",
    previewBg: "bg-purple-950 border-cyan-400",
    containerClass: "bg-[#09021A] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]",
    bubbleMine: "bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/30",
    bubbleOther: "border border-fuchsia-500/30 bg-purple-950/60 text-cyan-100 backdrop-blur-md shadow-md",
  },
  midnight: {
    id: "midnight",
    name: "Midnight Velvet Purple",
    previewBg: "bg-indigo-950 border-indigo-500",
    containerClass: "bg-[#0B091A] bg-[radial-gradient(#2A1A4E_1px,transparent_1px)] [background-size:20px_20px]",
    bubbleMine: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg border border-purple-400/20",
    bubbleOther: "border border-indigo-500/20 bg-indigo-950/40 text-purple-100 shadow-md",
  },
  sunset: {
    id: "sunset",
    name: "Warm Gold Sunset",
    previewBg: "bg-amber-950 border-amber-500",
    containerClass: "bg-[#180D06] bg-[radial-gradient(ellipse_70%_70%_at_50%_100%,rgba(245,158,11,0.15),rgba(0,0,0,0))]",
    bubbleMine: "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg border border-amber-300/30",
    bubbleOther: "border border-amber-500/20 bg-amber-950/40 text-amber-100 shadow-md",
  },
  minimal: {
    id: "minimal",
    name: "Slate Minimalist",
    previewBg: "bg-slate-800 border-slate-400",
    containerClass: "bg-[#0F172A] light:bg-[#F8FAFC]",
    bubbleMine: "bg-slate-700 text-white border border-slate-600 shadow-sm",
    bubbleOther: "bg-slate-800 light:bg-slate-200 text-slate-200 light:text-slate-800 border border-slate-700/50 shadow-sm",
  },
};
