"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlaySquare, Rss, Heart } from "lucide-react";

import MobileCreateButton from "./MobileCreateButton";
import MobileProfileMenu from "./MobileProfileMenu";

export default function MobileBottomNav() {
  const pathname = usePathname() || "";

  const isHomeActive = pathname === "/";
  const isRaftaarActive = pathname.startsWith("/shorts");
  const isWatchlistActive = pathname.startsWith("/watchlist");
  const isSubscriptionsActive = pathname.startsWith("/subscriptions") || pathname.startsWith("/in-family");
  const isProfileActive =
    pathname.startsWith("/profile") ||
    pathname.startsWith("/my-videos") ||
    pathname.startsWith("/playlists") ||
    pathname.startsWith("/liked-videos") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/channel");

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
        py-1.5
        pb-[calc(0.5rem+env(safe-area-inset-bottom))]
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
          py-1
          rounded-2xl
          transition-all
          duration-200
          ${
            isHomeActive
              ? "bg-gradient-to-b from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] scale-105 font-black"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <Home size={isHomeActive ? 22 : 20} className={isHomeActive ? "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" : ""} />
        <span className={`text-[10px] ${isHomeActive ? "font-black text-orange-400" : "font-medium"}`}>Home</span>
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
          py-1
          rounded-2xl
          transition-all
          duration-200
          ${
            isRaftaarActive
              ? "bg-gradient-to-b from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] scale-105 font-black"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <PlaySquare size={isRaftaarActive ? 22 : 20} className={isRaftaarActive ? "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" : ""} />
        <span className={`text-[10px] ${isRaftaarActive ? "font-black text-orange-400" : "font-medium"}`}>Raftaar</span>
      </Link>

      {/* Watchlist */}
      <Link
        href="/watchlist"
        className={`
          flex
          flex-col
          items-center
          gap-0.5
          px-3
          py-1
          rounded-2xl
          transition-all
          duration-200
          ${
            isWatchlistActive
              ? "bg-gradient-to-b from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] scale-105 font-black"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <Heart size={isWatchlistActive ? 22 : 20} className={isWatchlistActive ? "text-orange-400 fill-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" : ""} />
        <span className={`text-[10px] ${isWatchlistActive ? "font-black text-orange-400" : "font-medium"}`}>Watchlist</span>
      </Link>

      {/* + Create Button */}
      <div className="flex flex-col items-center justify-center px-1">
        <MobileCreateButton />
      </div>

      {/* In-Family */}
      <Link
        href="/subscriptions"
        className={`
          flex
          flex-col
          items-center
          gap-0.5
          px-3
          py-1
          rounded-2xl
          transition-all
          duration-200
          ${
            isSubscriptionsActive
              ? "bg-gradient-to-b from-orange-500/20 to-amber-500/10 border border-orange-500/40 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)] scale-105 font-black"
              : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
          }
        `}
      >
        <Rss size={isSubscriptionsActive ? 22 : 20} className={isSubscriptionsActive ? "text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" : ""} />
        <span className={`text-[10px] ${isSubscriptionsActive ? "font-black text-orange-400" : "font-medium"}`}>In-Family</span>
      </Link>

      {/* My Profile */}
      <MobileProfileMenu isActive={isProfileActive} />
    </nav>
  );
}
