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
        justify-center
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
      <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">

        <span className="text-[13px] leading-none">
          {icon}
        </span>

        <span className="whitespace-nowrap">
          Good {greeting}
        </span>

      </span>

      <span
        className="
          mt-1
          text-[14px]
          font-bold
          tracking-tight
          text-white
          drop-shadow-[0_1px_6px_rgba(255,255,255,.18)]
        "
      >
        Ram
      </span>

    </div>
  );
}