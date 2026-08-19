"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  User,
  Heart,
  MessageSquare,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";

import Greeting from "./Greeting";
import { useAuthModal } from "./auth/AuthProvider";

export default function NavbarProfile() {
  const [open, setOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { user, authLoading, signedIn, signOut, openSignIn } = useAuthModal();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Downloads is intentionally not linked here — it's an app-only feature
  // (see app/downloads/page.tsx), not offered on the website.
  const menu = [
    { icon: User, title: "Your Channel", href: "/my-videos" },
    { icon: User, title: "My Profile", href: "/profile" },
    { icon: Heart, title: "Watchlist", href: "/watchlist" },
    // MilonBook is the product name for what still routes as /messages —
    // the route is deliberately unchanged (every deep link and notification
    // points at it); /milonbook exists as an alias. See app/milonbook.
    { icon: MessageSquare, title: "My MilonBook", href: "/messages" },
    { icon: Settings, title: "Settings", href: "/settings" },
    { icon: HelpCircle, title: "Help & Support", href: "/help" },
  ];

  const handleItemClick = (href: string | null) => {
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  // While the initial session check is running, avoid flashing either
  // state incorrectly
  if (authLoading) {
    return (
      <div className="h-11 w-11 animate-pulse rounded-full bg-white/10 light:bg-black/5" />
    );
  }

  // Not signed in — show a simple Sign In button instead of a fake profile
  if (!signedIn) {
    return (
      <button
        onClick={openSignIn}
        className="
          rounded-full
          border
          border-white/10
          light:border-black/10
          bg-white/5
          light:bg-black/5
          px-5
          py-2.5
          text-sm
          font-semibold
          text-white
          light:text-slate-900
          backdrop-blur-3xl
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-orange-400/40
          hover:bg-orange-500/10
        "
      >
        Sign In
      </button>
    );
  }

  return (
    <div
      ref={profileRef}
      className="relative block"
    >
      <button
        onClick={() => setOpen(!open)}
        className="
  group
  flex
  items-center
  gap-3
  rounded-full
  border
  border-white/10
  light:border-black/10
  bg-white/5
  light:bg-black/5
  px-3
  py-2.5
  backdrop-blur-3xl
  shadow-[0_10px_30px_rgba(0,0,0,.25)]
  light:shadow-[0_10px_30px_rgba(0,0,0,.08)]
  transition-all
  duration-300
  hover:-translate-y-1
  hover:border-orange-400/40
  hover:bg-white/[0.08]
  light:hover:bg-black/[0.08]
  hover:shadow-[0_0_35px_rgba(249,115,22,.18)]
"
      >
        <img
          src={user?.avatarUrl || "/avatars/avatar.png"}
          alt="Profile"
          className="h-11 w-11 rounded-full object-cover ring-2 ring-orange-400/40 transition-all duration-300 group-hover:ring-orange-300"
        />

<div className="hidden md:block">
<div className="hidden xl:flex">
  <Greeting name={user?.name} />
</div>
</div>

        <ChevronDown
          size={16}
          className={`text-slate-300 light:text-slate-600 transition-all duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`
          absolute
          right-0
          mt-3
          w-[220px]
          overflow-hidden
          rounded-3xl
          border
          border-white/10
          light:border-black/10
bg-[#08111F]/95
          light:bg-[#F5EEDC]/95
          backdrop-blur-3xl
          shadow-[0_30px_80px_rgba(0,0,0,.55)]
          light:shadow-[0_30px_80px_rgba(0,0,0,.15)]
          transition-all
          duration-300
          origin-top-right
          ${
            open
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
          }
        `}
      >
        <div className="p-4 text-center">

          <img
            src={user?.avatarUrl || "/avatars/avatar.png"}
            alt="Profile"
            className="mx-auto h-12 w-12 rounded-full ring-2 ring-orange-200"
          />

          <h3 className="mt-3 text-lg font-black text-white light:text-slate-900">
            {user?.name}
          </h3>

        </div>

        <div className="border-t border-white/10 light:border-black/10 p-2">

          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                onClick={() => handleItemClick(item.href)}
                className="
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-xl
                  px-3
                  py-2.5
                  text-left
                  transition-all
                  duration-200
                  hover:bg-white/5 light:hover:bg-black/5 hover:translate-x-1
                "
              >
                <Icon
                  size={16}
                  className="text-orange-400"
                />

                <span className="text-[15px] font-bold text-white light:text-slate-900 leading-none">
                  {item.title}
                </span>
              </button>
            );
          })}

          <div className="my-2 border-t border-white/10 light:border-black/10" />

          <button
            onClick={handleSignOut}
            className="
              flex
              w-full
              items-center
              gap-3
              rounded-xl
              px-3
              py-2.5
              text-[13px]
              font-medium
              text-red-500
              transition-all
              duration-200
              hover:bg-red-500/10 hover:translate-x-1
            "
          >
            <LogOut size={16} />
            Sign Out
          </button>

        </div>
      </div>
    </div>
  );
}
