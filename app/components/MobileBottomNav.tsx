"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlaySquare, Music2 } from "lucide-react";

import MobileCreateButton from "./MobileCreateButton";
import MobileProfileMenu from "./MobileProfileMenu";

export default function MobileBottomNav() {
  const pathname = usePathname() || "";

  const isHomeActive = pathname === "/";
  const isRaftaarActive = pathname.startsWith("/shorts");
  const isMusicActive = pathname.startsWith("/music");
  const isProfileActive =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/my-videos") ||
    pathname.startsWith("/playlists") ||
    pathname.startsWith("/liked-videos") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/channel") ||
    pathname.startsWith("/watchlist");

  return (
    <nav
      className="
        lg:hidden
        fixed
        bottom-0
        left-0
        right-0
        z-[95]
        flex
        items-center
        justify-around
        border-t
        border-white/10
        light:border-black/10
        bg-[#06101D]/95
        light:bg-[#F5EEDC]/95
        backdrop-blur-2xl
        px-2
        pt-2
        shadow-[0_-4px_25px_rgba(0,0,0,0.4)]
      "
    >
      {/* Home */}
      <Link
        href="/"
        className={`
          flex
          flex-col
          items-center
          gap-0.5
          px-3
          pt-1
          pb-[calc(0.5rem+env(safe-area-inset-bottom))]
          transition-all
          duration-200
          ${
            isHomeActive
              ? "text-orange-400 font-black scale-105"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <Home size={21} className={isHomeActive ? "text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.85)] filter" : ""} />
        <span className={`text-[10px] ${isHomeActive ? "font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]" : "font-medium"}`}>
          Home
        </span>
      </Link>

      {/* Raftaar / Shorts */}
      <Link
        href="/shorts"
        className={`
          flex
          flex-col
          items-center
          gap-0.5
          px-3
          pt-1
          pb-[calc(0.5rem+env(safe-area-inset-bottom))]
          transition-all
          duration-200
          ${
            isRaftaarActive
              ? "text-orange-400 font-black scale-105"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <PlaySquare size={21} className={isRaftaarActive ? "text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.85)] filter" : ""} />
        <span className={`text-[10px] ${isRaftaarActive ? "font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]" : "font-medium"}`}>
          Raftaar
        </span>
      </Link>

      {/* + Create Button */}
      <div className="flex flex-col items-center justify-center px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-0.5">
        <MobileCreateButton />
      </div>

      {/* Music */}
      <Link
        href="/music"
        className={`
          flex
          flex-col
          items-center
          gap-0.5
          px-3
          pt-1
          pb-[calc(0.5rem+env(safe-area-inset-bottom))]
          transition-all
          duration-200
          ${
            isMusicActive
              ? "text-orange-400 font-black scale-105"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <Music2 size={21} className={isMusicActive ? "text-orange-400 drop-shadow-[0_0_12px_rgba(249,115,22,0.85)] filter" : ""} />
        <span className={`text-[10px] ${isMusicActive ? "font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]" : "font-medium"}`}>
          Music
        </span>
      </Link>

      {/* My Profile / You */}
      <MobileProfileMenu isActive={isProfileActive} />
    </nav>
  );
}
