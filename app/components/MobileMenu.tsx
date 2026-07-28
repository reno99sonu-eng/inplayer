"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Menu,
  X,
  Home,
  Compass,
  PlaySquare,
  Radio,
  Users,
  Sparkles,
  ShoppingBag,
  History,
} from "lucide-react";

const links = [
  { icon: Home, title: "Home", href: "/" },
  { icon: Compass, title: "Explore", href: "/explore" },
  { icon: PlaySquare, title: "Shorts", href: "/shorts" },
  { icon: Radio, title: "Live", href: "/live" },
  { icon: Users, title: "Creators", href: "/creators" },
  { icon: Sparkles, title: "AI Studio", href: "/ai-studio" },
  { icon: ShoppingBag, title: "Marketplace", href: "/marketplace" },

  // NEW
  { icon: History, title: "History", href: "/history" },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-full
          border
          border-white/30
          bg-white/80
          backdrop-blur-xl
          transition-all
          duration-300
          hover:scale-105
        "
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          className="
            fixed
            inset-0
            z-[999]
            bg-[#050811]/55
            backdrop-blur-3xl
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-white/10
              bg-white/[0.02]
              px-6
              py-6
            "
          >
            <h2 className="text-2xl font-black tracking-tight text-white">
              INPLAYER
            </h2>

            <button
              onClick={() => setOpen(false)}
              className="
                rounded-full
                border
                border-white/10
                bg-white/5
                p-2
                text-white
                transition-all
                duration-300
                hover:bg-white/15
              "
            >
              <X size={22} />
            </button>
          </div>

          <div className="space-y-3 p-6">

            {links.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="
                    flex
                    w-full
                    items-center
                    gap-4
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/[0.03]
                    backdrop-blur-xl
                    px-5
                    py-4
                    text-left
                    text-white
                    transition-all
                    duration-300
                    hover:bg-orange-500/15
                    hover:border-orange-400/30
                    hover:translate-x-2
                  "
                >
                  <Icon size={22} />

                  <span className="text-lg font-medium">
                    {item.title}
                  </span>
                </Link>
              );
            })}

            <div className="space-y-3 pt-8">

              <button
                className="
                  w-full
                  rounded-full
                  border
                  border-white/20
                  bg-white/[0.03]
                  py-3
                  font-semibold
                  text-white
                  transition
                  hover:bg-white/10
                "
              >
                Sign In
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}