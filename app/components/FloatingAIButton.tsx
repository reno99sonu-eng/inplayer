"use client";

import { useEffect, useState } from "react";
import AIStudioModal from "./AIStudioModal";

export default function FloatingAIButton() {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const footer = document.querySelector("footer");

      if (!footer) return;

      const rect = footer.getBoundingClientRect();

      setHidden(rect.top < window.innerHeight);
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`
          fixed
          bottom-24
          right-5
          z-[96]
          lg:bottom-6
          lg:right-6
          flex
          h-16
          w-16
          items-center
          justify-center
          rounded-full
          border
          border-orange-400/20
          bg-gradient-to-br
          from-[#1B2435]
          to-[#0B1020]
          shadow-[0_0_40px_rgba(255,170,0,0.35)]
          transition-all
          duration-500
          hover:scale-110
          ${
            hidden
              ? "translate-y-32 opacity-0 pointer-events-none"
              : "translate-y-0 opacity-100"
          }
        `}
      >
        <span className="text-2xl text-amber-300">✦</span>
      </button>

      <AIStudioModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
