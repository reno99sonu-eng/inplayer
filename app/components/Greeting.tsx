"use client";

import { useEffect, useState } from "react";

export default function Greeting() {
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 5) {
      setGreeting("Good Night");
    } else if (hour < 12) {
      setGreeting("Good Morning");
    } else if (hour < 17) {
      setGreeting("Good Afternoon");
    } else if (hour < 21) {
      setGreeting("Good Evening");
    } else {
      setGreeting("Good Night");
    }
  }, []);

  return (
    <div className="flex flex-col leading-tight">

      <span className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
        {greeting}
      </span>

      <span className="text-[15px] font-semibold text-slate-800">
        Ram
      </span>

    </div>
  );
}