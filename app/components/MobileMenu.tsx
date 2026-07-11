"use client";

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
  Crown,
} from "lucide-react";

const links = [
  { icon: Home, title: "Home" },
  { icon: Compass, title: "Explore" },
  { icon: PlaySquare, title: "Shorts" },
  { icon: Radio, title: "Live" },
  { icon: Users, title: "Creators" },
  { icon: Sparkles, title: "AI Studio" },
  { icon: ShoppingBag, title: "Marketplace" },
  { icon: Crown, title: "Premium" },
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
                <button
                  key={item.title}
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
                </button>
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

              <button
                className="
                  w-full
                  rounded-full
                  bg-gradient-to-r
                  from-orange-500
                  to-amber-400
                  py-3
                  font-bold
                  text-slate-900
                "
              >
                ✦ Premium
              </button>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}