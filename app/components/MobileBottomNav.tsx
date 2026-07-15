"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, PlaySquare, Rss } from "lucide-react";

import MobileCreateButton from "./MobileCreateButton";
import MobileProfileScreen from "./MobileProfileScreen";

export default function MobileBottomNav() {
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (profileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [profileOpen]);

  return (
    <>
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
          bg-[#06101D]/95
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
            transition-colors
            duration-200
            hover:text-orange-300
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
            transition-colors
            duration-200
            hover:text-orange-300
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
            transition-colors
            duration-200
            hover:text-orange-300
          "
        >
          <Rss size={22} />
          <span className="text-[11px] font-medium">Subscriptions</span>
        </Link>

        <button
          onClick={() => setProfileOpen(true)}
          className="
            flex
            flex-col
            items-center
            gap-1
            px-3
            py-1
            text-slate-300
            transition-colors
            duration-200
            hover:text-orange-300
          "
        >
          <img
            src="/avatars/avatar.png"
            alt="Profile"
            className="h-6 w-6 rounded-full object-cover ring-1 ring-orange-400/50"
          />
          <span className="text-[11px] font-medium">You</span>
        </button>
      </nav>

      <MobileProfileScreen
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </>
  );
}
