"use client";

import { useEffect, useState } from "react";

export default function FloatingAIButton() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const footer = document.querySelector("footer");

      if (!footer) return;

      const rect = footer.getBoundingClientRect();

      // Hide when footer enters the viewport
      setHidden(rect.top < window.innerHeight);
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      className={`
        fixed bottom-6 right-6 z-50
        h-16 w-16 rounded-full
        bg-gradient-to-br from-[#1B2435] to-[#0B1020]
        shadow-[0_0_40px_rgba(255,170,0,0.35)]
        border border-orange-400/20
        transition-all duration-500
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
  );
}