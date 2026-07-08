"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  "Home",
  "Movies",
  "TV Shows",
  "Shorts",
  "Live",
  "Creators",
  "Gaming",
  "Music",
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
          border-slate-200
          bg-white/90
          shadow-sm
          transition-all
          duration-300
          hover:shadow-lg
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
            bg-slate-950/95
            backdrop-blur-2xl
          "
        >
          <div className="flex items-center justify-between border-b border-white/10 p-6">

            <h2 className="text-xl font-bold text-white">
              INPLAYER
            </h2>

            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 p-2 text-white"
            >
              <X size={22} />
            </button>

          </div>

          <div className="flex flex-col gap-2 p-6">

            {links.map((item) => (
              <button
                key={item}
                onClick={() => setOpen(false)}
                className="
                  rounded-2xl
                  px-5
                  py-4
                  text-left
                  text-lg
                  font-medium
                  text-white
                  transition
                  hover:bg-white/10
                "
              >
                {item}
              </button>
            ))}

            <div className="mt-8 space-y-3">

              <button className="w-full rounded-full border border-white/20 py-3 font-semibold text-white">
                Login
              </button>

              <button className="w-full rounded-full bg-orange-500 py-3 font-semibold text-white">
                Premium
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}