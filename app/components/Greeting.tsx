"use client";

import { useEffect, useState } from "react";

export default function Greeting() {
  const [greeting, setGreeting] = useState("");
  const [icon, setIcon] = useState("☀️");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      setGreeting("Morning");
      setIcon("☀️");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Afternoon");
      setIcon("🌤️");
    } else if (hour >= 17 && hour < 21) {
      setGreeting("Evening");
      setIcon("🌇");
    } else {
      setGreeting("Night");
      setIcon("🌙");
    }

    const timer = setTimeout(() => {
      setLoaded(true);
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`
        hidden
        xl:flex
        flex-col
        leading-none
        transition-all
        duration-700
        ${
          loaded
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2"
        }
      `}
    >
      <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-500">

        <span className="animate-pulse text-[15px] leading-none">
          {icon}
        </span>

        <span className="font-semibold">
          Good {greeting}
        </span>

      </span>

      <span
        className="
          mt-1
          text-[13px]
          font-black
          tracking-[-0.02em]
          text-slate-950
          drop-shadow-[0_1px_2px_rgba(255,255,255,0.15)]
          transition-colors
          duration-300
        "
      >
        Ram
      </span>

    </div>
  );
}