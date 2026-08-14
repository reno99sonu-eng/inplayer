export interface ChatTheme {
  id: string;
  name: string;
  previewBg: string;
  containerClass: string;
  bubbleMine: string;
  bubbleOther: string;
  texturePattern: string; // CSS background-image or SVG texture Data URI
  backgroundImageUrl?: string; // High-resolution rich background wallpaper image
}

// High-definition SVG Wallpaper Textures
const WHATSAPP_DOODLE_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cpath fill='%23054640' fill-opacity='0.45' d='M20 15a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm50 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-25 35a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-35 25a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm80 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-55 35a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm50 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM15 40h10v2H15zm80 0h10v2H95zM45 90h10v2H45zm30-70h2v10h-2zm-50 70h2v10h-2z'/%3E%3Cpath fill='%23054640' fill-opacity='0.35' d='M85 25l-5 5 5 5 5-5-5-5zm-60 50l-4 4 4 4 4-4-4-4zm60 0l-4 4 4 4 4-4-4-4zM55 10l-4 4 4 4 4-4-4-4z'/%3E%3Ccircle cx='30' cy='30' r='3' fill='%23128C7E' fill-opacity='0.3'/%3E%3Ccircle cx='90' cy='30' r='3' fill='%23128C7E' fill-opacity='0.3'/%3E%3Ccircle cx='60' cy='60' r='4' fill='%23128C7E' fill-opacity='0.35'/%3E%3Ccircle cx='30' cy='90' r='3' fill='%23128C7E' fill-opacity='0.3'/%3E%3Ccircle cx='90' cy='90' r='3' fill='%23128C7E' fill-opacity='0.3'/%3E%3C/svg%3E")`;

const CYBERPUNK_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%2306b6d4' stroke-width='0.7' stroke-opacity='0.25'%3E%3Cpath d='M0 0l40 40M40 0L0 40M40 40l40 40M80 40L40 80'/%3E%3Cpath d='M0 40h80M40 0v80' stroke-dasharray='2,2'/%3E%3Ccircle cx='40' cy='40' r='3' fill='%2306b6d4' fill-opacity='0.4'/%3E%3Ccircle cx='0' cy='0' r='2' fill='%23e879f9' fill-opacity='0.4'/%3E%3Ccircle cx='80' cy='0' r='2' fill='%23e879f9' fill-opacity='0.4'/%3E%3Ccircle cx='0' cy='80' r='2' fill='%23e879f9' fill-opacity='0.4'/%3E%3Ccircle cx='80' cy='80' r='2' fill='%23e879f9' fill-opacity='0.4'/%3E%3C/g%3E%3C/svg%3E")`;

const STARDUST_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='%23a855f7' fill-opacity='0.3'%3E%3Ccircle cx='10' cy='10' r='1.5'/%3E%3Ccircle cx='50' cy='20' r='2'/%3E%3Ccircle cx='80' cy='15' r='1'/%3E%3Ccircle cx='30' cy='60' r='1.5'/%3E%3Ccircle cx='70' cy='70' r='2.5'/%3E%3Ccircle cx='90' cy='45' r='1'/%3E%3Ccircle cx='20' cy='85' r='2'/%3E%3Cpath d='M50 50l3-3-3-3-3 3 3 3z' fill='%23c084fc' fill-opacity='0.4'/%3E%3Cpath d='M15 40l2-2-2-2-2 2 2 2z' fill='%23e879f9' fill-opacity='0.35'/%3E%3Cpath d='M85 80l2-2-2-2-2 2 2 2z' fill='%23818cf8' fill-opacity='0.4'/%3E%3C/g%3E%3C/svg%3E")`;

const DAMASK_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 90 90'%3E%3Cpath fill='none' stroke='%23f59e0b' stroke-width='0.8' stroke-opacity='0.25' d='M45 0c15 15 15 30 0 45C30 30 30 15 45 0zm0 45c15 15 15 30 0 45C30 75 30 60 45 45zM0 45c15-15 30-15 45 0C30 60 15 60 0 45zm45 0c15-15 30-15 45 0C75 60 60 60 45 45z'/%3E%3Ccircle cx='45' cy='45' r='4' fill='%23f59e0b' fill-opacity='0.3'/%3E%3C/svg%3E")`;

const CARBON_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill='%23334155' fill-opacity='0.3'%3E%3Cpath d='M0 20L20 0h20L0 40zM20 40l20-20v20z'/%3E%3Cpath d='M0 0h20L0 20zM40 0v20L20 40h20z' fill-opacity='0.15'/%3E%3C/g%3E%3C/svg%3E")`;

const OBSIDIAN_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill='none' stroke='%23f97316' stroke-width='0.6' stroke-opacity='0.2'%3E%3Cpath d='M50 0L100 50L50 100L0 50Z'/%3E%3Cpath d='M25 25L75 25L75 75L25 75Z' stroke-dasharray='3,3'/%3E%3Ccircle cx='50' cy='50' r='3' fill='%23f97316' fill-opacity='0.3'/%3E%3C/g%3E%3C/svg%3E")`;

export const CHAT_THEMES: Record<string, ChatTheme> = {
  default: {
    id: "default",
    name: "Obsidian Amber Glass",
    previewBg: "bg-[#060D17] border-orange-500/50",
    containerClass: "bg-[#060D17] text-white",
    bubbleMine: "bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] text-slate-950 font-semibold shadow-lg shadow-orange-500/20",
    bubbleOther: "border border-white/10 bg-[#0E1A2B]/90 backdrop-blur-md text-slate-100 shadow-md",
    texturePattern: OBSIDIAN_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80",
  },
  emerald: {
    id: "emerald",
    name: "WhatsApp Signature Emerald",
    previewBg: "bg-[#0B141A] border-emerald-500",
    containerClass: "bg-[#0B141A] text-white",
    bubbleMine: "bg-[#005C4B] text-white shadow-md border border-emerald-500/30",
    bubbleOther: "bg-[#202C33]/90 backdrop-blur-md text-slate-100 shadow-md border border-white/10",
    texturePattern: WHATSAPP_DOODLE_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1920&q=80",
  },
  emeraldLight: {
    id: "emeraldLight",
    name: "WhatsApp Light Signature",
    previewBg: "bg-[#EFEAE2] border-[#25D366]",
    containerClass: "bg-[#EFEAE2] text-slate-900",
    bubbleMine: "bg-[#D9FDD3] text-slate-900 shadow-sm border border-emerald-500/20",
    bubbleOther: "bg-white/95 backdrop-blur-md text-slate-900 shadow-sm border border-slate-200",
    texturePattern: WHATSAPP_DOODLE_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1920&q=80",
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon Mesh",
    previewBg: "bg-[#070214] border-cyan-400",
    containerClass: "bg-[#070214] text-cyan-100",
    bubbleMine: "bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-600 text-white shadow-[0_0_18px_rgba(6,182,212,0.4)] border border-cyan-300/40 font-semibold",
    bubbleOther: "border border-cyan-500/30 bg-[#12082A]/90 backdrop-blur-md text-cyan-100 shadow-lg",
    texturePattern: CYBERPUNK_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=80",
  },
  midnight: {
    id: "midnight",
    name: "Midnight Galaxy Stars",
    previewBg: "bg-[#0A071B] border-purple-500",
    containerClass: "bg-[#0A071B] text-purple-100",
    bubbleMine: "bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 text-white shadow-lg border border-purple-400/30 font-semibold",
    bubbleOther: "border border-purple-500/20 bg-[#150F2E]/90 backdrop-blur-md text-purple-100 shadow-md",
    texturePattern: STARDUST_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80",
  },
  sunset: {
    id: "sunset",
    name: "Warm Gold Sunset",
    previewBg: "bg-[#160B04] border-amber-500",
    containerClass: "bg-[#160B04] text-amber-100",
    bubbleMine: "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-semibold shadow-lg shadow-orange-500/20 border border-amber-300/40",
    bubbleOther: "border border-amber-500/25 bg-[#261308]/90 backdrop-blur-md text-amber-100 shadow-md",
    texturePattern: DAMASK_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80",
  },
  minimal: {
    id: "minimal",
    name: "Carbon Micro-Weave",
    previewBg: "bg-[#0B1220] border-slate-500",
    containerClass: "bg-[#0B1220] text-slate-100",
    bubbleMine: "bg-[#1D4ED8] text-white font-medium shadow-md border border-blue-400/30",
    bubbleOther: "bg-[#1E293B]/90 backdrop-blur-md text-slate-200 shadow-md border border-slate-700/60",
    texturePattern: CARBON_TEXTURE,
    backgroundImageUrl: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80",
  },
};
