"use client";

import React, { useState, useEffect } from "react";
import { Headphones, Radio } from "lucide-react";
import type { MusicTrack } from "@/app/context/MusicPlayerContext";

interface ListeningToast {
  id: string;
  user: string;
  city: string;
  songTitle: string;
}

const CITIES = [
  "Mumbai",
  "Bengaluru",
  "Delhi NCR",
  "Kolkata",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Jaipur",
  "Chandigarh",
  "Ahmedabad",
  "Kochi",
  "Lucknow",
  "Guwahati",
  "Bhopal",
];

const NAMES = [
  "Aarav",
  "Diya",
  "Rohan",
  "Ananya",
  "Vikram",
  "Pooja",
  "Kabir",
  "Sneha",
  "Aditya",
  "Isha",
  "Arjun",
  "Meera",
];

export default function LiveListeningToasts({ tracks }: { tracks?: MusicTrack[] }) {
  const [toast, setToast] = useState<ListeningToast | null>(null);

  useEffect(() => {
    if (!tracks || tracks.length === 0) return;

    // Trigger a random flash card every 12 to 24 seconds
    const interval = setInterval(() => {
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)];
      const randomName = NAMES[Math.floor(Math.random() * NAMES.length)];

      const newToast: ListeningToast = {
        id: Math.random().toString(),
        user: randomName,
        city: randomCity,
        songTitle: randomTrack.title,
      };

      setToast(newToast);

      // Dismiss after exactly 2 seconds as required by specification
      const timer = setTimeout(() => {
        setToast(null);
      }, 2000);

      return () => clearTimeout(timer);
    }, 14000);

    return () => clearInterval(interval);
  }, [tracks]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-24 left-4 lg:bottom-6 lg:left-6 z-[110] pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center gap-2.5 rounded-2xl bg-[#061122]/90 light:bg-[#FAF6EF]/95 border border-orange-500/40 px-3.5 py-2 shadow-[0_10px_30px_rgba(249,115,22,0.3)] backdrop-blur-xl max-w-sm">
        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
          <Headphones size={15} className="animate-bounce" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400 light:text-orange-600 flex items-center gap-1">
            <Radio size={10} className="animate-pulse" /> Live in {toast.city}
          </p>
          <p className="text-xs font-semibold text-white light:text-slate-900 truncate">
            {toast.user} is listening to &quot;{toast.songTitle}&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
