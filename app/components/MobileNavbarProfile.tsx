"use client";

import { useEffect, useRef, useState } from "react";
import {
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

export default function MobileNavbarProfile() {
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
    <div ref={profileRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-orange-400/40 hover:bg-white/[0.08]"
      >
        <img
          src="/avatars/avatar.png"
          alt="Profile"
          className="h-9 w-9 rounded-full object-cover ring-2 ring-orange-400/40"
        />
      </button>

      <div
        className={`absolute right-0 mt-3 w-[220px] overflow-hidden rounded-3xl border border-white/10 bg-[#08111F]/95 backdrop-blur-3xl shadow-[0_30px_80px_rgba(0,0,0,.55)] transition-all duration-300 origin-top-right ${
          open
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="p-4 text-center">
          <img
            src="/avatars/avatar.png"
            alt="Profile"
            className="mx-auto h-12 w-12 rounded-full ring-2 ring-orange-200"
          />

          <div className="mt-2 flex justify-center">
            <Greeting />
          </div>

          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1 text-[10px] font-semibold text-white">
            <Crown size={12} />
            Premium
          </div>
        </div>

        <div className="border-t border-white/10 p-2">
          {menu.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-white/5 hover:translate-x-1"
              >
                <Icon size={16} className="text-orange-400" />
                <span className="text-[15px] font-bold text-white">
                  {item.title}
                </span>
              </button>
            );
          })}

          <div className="my-2 border-t border-white/10" />

          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-red-500 transition-all duration-200 hover:bg-red-500/10 hover:translate-x-1">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}