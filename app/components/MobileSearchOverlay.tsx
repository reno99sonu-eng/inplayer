"use client";

import { Search, X, Mic, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface MobileSearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

const placeholders = [
  "Search AI...",
  "Search Movies...",
  "Search TV Shows...",
  "Search Music...",
  "Search Podcasts...",
  "Search Live...",
  "Search Shorts...",
  "Search Creators...",
];

export default function MobileSearchOverlay({
  open,
  onClose,
}: MobileSearchOverlayProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setPlaceholderIndex(
        (prev) => (prev + 1) % placeholders.length
      );
    }, 2200);

    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Blur Background */}
      <div
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Search Panel */}
      <div className="fixed inset-x-0 top-0 z-[130] border-b border-white/10 light:border-black/10 bg-[#07101F]/95 light:bg-[#F5EEDC]/95 p-4 backdrop-blur-3xl">
        <div className="flex items-center gap-3">

          {/* Close Button */}
          <button
            onClick={onClose}
            className="
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-2xl
              border
              border-white/10
              light:border-black/10
              bg-white/5
              light:bg-black/5
              text-white
              light:text-slate-900
              transition-all
              duration-300
              hover:bg-white/10
              light:hover:bg-black/10
            "
          >
            <X size={24} />
          </button>

          {/* Premium Search */}
          <div className="relative flex-1">

            {/* Search Icon */}
            <Search
              size={22}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 light:text-slate-600"
            />

            {/* Search Input */}
            <input
              autoFocus
              type="text"
              placeholder={placeholders[placeholderIndex]}
              className="
                h-14
                w-full
                rounded-full
                border
                border-white/10
                light:border-black/10
                bg-white/5
                light:bg-black/[0.04]
                backdrop-blur-xl
                pl-14
                pr-24
                text-[17px]
                font-medium
                text-white
                light:text-slate-900
                caret-orange-400
                outline-none
                placeholder:text-slate-400
                light:placeholder:text-slate-400
                shadow-[0_10px_35px_rgba(0,0,0,.35)]
                light:shadow-[0_10px_35px_rgba(0,0,0,.08)]
                transition-all
                duration-300
                focus:border-orange-400/40
                focus:bg-white/[0.07]
                light:focus:bg-black/[0.06]
              "
            />

            {/* AI + Voice */}
            <div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-3">

              <button
                type="button"
                className="text-orange-400 transition-all duration-300 hover:scale-110"
              >
                <Sparkles size={19} />
              </button>

              <button
                type="button"
                className="text-white light:text-slate-700 transition-all duration-300 hover:scale-110"
              >
                <Mic size={19} />
              </button>

            </div>

          </div>

        </div>
      </div>
    </>
  );
}
