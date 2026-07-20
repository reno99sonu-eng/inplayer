"use client";

import Link from "next/link";
import { Home, PlaySquare, Rss } from "lucide-react";

import MobileCreateButton from "./MobileCreateButton";
import { useAuthModal } from "./auth/AuthProvider";

export default function MobileBottomNav() {
  const { user } = useAuthModal();

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
        py-2
        pb-[calc(0.5rem+env(safe-area-inset-bottom))]
      "
    >
      <Link
        href="/"
        className="
          flex
          flex-col
          items-center
          gap-1
          px-3
          py-1
          text-slate-300
          light:text-slate-600
          transition-colors
          duration-200
          hover:text-orange-300
          light:hover:text-orange-600
        "
      >
        <Home size={22} />
        <span className="text-[11px] font-medium">Home</span>
      </Link>

      <Link
        href="/shorts"
        className="
          flex
          flex-col
          items-center
          gap-1
          px-3
          py-1
          text-slate-300
          light:text-slate-600
          transition-colors
          duration-200
          hover:text-orange-300
          light:hover:text-orange-600
        "
      >
        <PlaySquare size={22} />
        <span className="text-[11px] font-medium">Shorts</span>
      </Link>

      <div className="flex flex-col items-center justify-center px-2">
        <MobileCreateButton />
      </div>

      <Link
        href="/subscriptions"
        className="
          flex
          flex-col
          items-center
          gap-1
          px-3
          py-1
          text-slate-300
          light:text-slate-600
          transition-colors
          duration-200
          hover:text-orange-300
          light:hover:text-orange-600
        "
      >
        <Rss size={22} />
        <span className="text-[11px] font-medium">In-House</span>
      </Link>

      <Link
        href="/account"
        className="
          flex
          flex-col
          items-center
          gap-1
          px-3
          py-1
          text-slate-300
          light:text-slate-600
          transition-colors
          duration-200
          hover:text-orange-300
          light:hover:text-orange-600
        "
      >
        <img
          src={user?.avatarUrl || "/avatars/avatar.png"}
          alt="Profile"
          className="h-6 w-6 rounded-full object-cover ring-1 ring-orange-400/50"
        />
        <span className="text-[11px] font-medium">You</span>
      </Link>
    </nav>
  );
}
