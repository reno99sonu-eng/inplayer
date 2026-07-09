"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  User,
  Heart,
  PlayCircle,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  Crown,
} from "lucide-react";

import Greeting from "./Greeting";

export default function NavbarProfile() {
  const [open, setOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  const menu = [
    { icon: User, title: "My Profile" },
    { icon: Heart, title: "Watchlist" },
    { icon: PlayCircle, title: "Continue Watching" },
    { icon: Download, title: "Downloads" },
    { icon: Settings, title: "Settings" },
    { icon: HelpCircle, title: "Help & Support" },
  ];

  return (
    <div
      ref={profileRef}
      className="relative hidden xl:block"
    >
      <button
        onClick={() => setOpen(!open)}
        className="
          flex
          items-center
          gap-2
          rounded-full
          border
          border-white/70
          bg-white/90
          px-2.5
          py-2
          shadow-lg
          backdrop-blur-xl
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:shadow-xl
        "
      >
        <img
          src="/avatars/avatar.png"
          alt="Profile"
          className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
        />

        <Greeting />

        <ChevronDown
          size={16}
          className={`transition duration-300 ${
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
          border-white/80
          bg-white/95
          backdrop-blur-3xl
          shadow-[0_20px_60px_rgba(0,0,0,0.12)]
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
            src="/avatars/avatar.png"
            alt="Profile"
            className="mx-auto h-12 w-12 rounded-full ring-2 ring-orange-200"
          />

          <h3 className="mt-2 text-lg font-bold text-slate-900">
            Ram
          </h3>

          <div
            className="
              mt-2
              inline-flex
              items-center
              gap-1.5
              rounded-full
              bg-gradient-to-r
              from-yellow-400
              to-orange-500
              px-3
              py-1
              text-[10px]
              font-semibold
              text-white
            "
          >
            <Crown size={12} />
            Premium
          </div>

        </div>

        <div className="border-t border-slate-200 p-2">

          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
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
                  hover:bg-orange-50
                "
              >
                <Icon
                  size={16}
                  className="text-slate-500"
                />

                <span className="text-[13px] font-medium text-slate-800">
                  {item.title}
                </span>
              </button>
            );
          })}

          <div className="my-2 border-t border-slate-200" />

          <button
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
              hover:bg-red-50
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