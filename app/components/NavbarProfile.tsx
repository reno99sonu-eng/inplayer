"use client";

import { useState } from "react";
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

  const menu = [
    { icon: User, title: "My Profile" },
    { icon: Heart, title: "Watchlist" },
    { icon: PlayCircle, title: "Continue Watching" },
    { icon: Download, title: "Downloads" },
    { icon: Settings, title: "Settings" },
    { icon: HelpCircle, title: "Help & Support" },
  ];

  return (
    <div className="relative hidden xl:block">

      <button
        onClick={() => setOpen(!open)}
        className="
          group
          flex
          items-center
          gap-3
          rounded-full
          border
          border-white/50
          bg-white/70
          backdrop-blur-xl
          px-3
          py-2
          shadow-lg
          transition-all
          duration-300
          hover:-translate-y-1
          hover:shadow-2xl
        "
      >
        <img
          src="/avatars/avatar.png"
          alt="Profile"
          className="
            h-11
            w-11
            rounded-full
            object-cover
            ring-2
            ring-white
            shadow-md
          "
        />

        <Greeting />

        <ChevronDown
          size={18}
          className={`transition duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (

        <div
          className="
            absolute
            right-0
            mt-4
            w-80
            overflow-hidden
            rounded-[30px]
            border
            border-white/40
            bg-white/85
            backdrop-blur-3xl
            shadow-[0_25px_70px_rgba(0,0,0,0.18)]
          "
        >

          <div className="p-8 text-center">

            <img
              src="/avatars/avatar.png"
              alt="Profile"
              className="mx-auto h-20 w-20 rounded-full ring-4 ring-orange-100"
            />

            <h3 className="mt-4 text-2xl font-bold text-slate-900">
              Ram
            </h3>

            <div
              className="
                mt-3
                inline-flex
                items-center
                gap-2
                rounded-full
                bg-gradient-to-r
                from-yellow-400
                to-orange-500
                px-4
                py-2
                text-sm
                font-semibold
                text-white
              "
            >
              <Crown size={16} />
              Premium Member
            </div>

          </div>

          <div className="border-t border-slate-200 p-3">

            {menu.map((item) => {

              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  className="
                    group
                    flex
                    w-full
                    items-center
                    gap-4
                    rounded-2xl
                    px-4
                    py-4
                    transition-all
                    duration-300
                    hover:bg-orange-50
                  "
                >
                  <Icon
                    size={20}
                    className="text-slate-500 group-hover:text-orange-500 transition"
                  />

                  <span className="font-medium text-slate-800">
                    {item.title}
                  </span>
                </button>
              );

            })}

            <div className="my-3 border-t border-slate-200" />

            <button
              className="
                flex
                w-full
                items-center
                gap-4
                rounded-2xl
                px-4
                py-4
                text-red-500
                transition
                hover:bg-red-50
              "
            >
              <LogOut size={20} />

              Sign Out
            </button>

          </div>

        </div>

      )}

    </div>
  );
}