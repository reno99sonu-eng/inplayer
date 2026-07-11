"use client";

import CreatePopup from "./CreatePopup";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Plus,
  Video,
  Radio,
  Mic2,
  Sparkles,
} from "lucide-react";

export default function NavbarActions() {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClick);
    }

    return () =>
      document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    {
      icon: <Video size={20} />,
      title: "Upload Video",
      subtitle: "Movies • Shorts • Series",
      color: "from-red-500 to-orange-500",
    },
    {
      icon: <Radio size={20} />,
      title: "Go Live",
      subtitle: "Streaming & Events",
      color: "from-orange-500 to-amber-400",
    },
    {
      icon: <Mic2 size={20} />,
      title: "Podcast",
      subtitle: "Voice & Audio Shows",
      color: "from-cyan-500 to-sky-400",
    },
    {
      icon: <Sparkles size={20} />,
      title: "AI Studio",
      subtitle: "Generate with AI",
      color: "from-violet-500 to-fuchsia-500",
    },
  ];

  return (
    <div className="relative flex items-center gap-3">

      {/* Create */}

      <button
  onClick={() => {
    console.log("Create clicked", !open);
    setOpen(!open);
  }}
  className="
    hidden lg:flex
    items-center
    gap-2
    rounded-full
    bg-gradient-to-r
    from-orange-500
    via-amber-400
    to-yellow-400
    px-5
    py-3
    text-sm
    font-bold
    text-slate-900
    shadow-xl
    transition-all
    duration-300
    hover:-translate-y-1
    hover:scale-105
  "
>
        
        <Plus size={18} />
        Create
      </button>

      {/* Popup */}

      <CreatePopup
  open={open}
  popupRef={popupRef}
  items={items}
/>

      {/* Notifications */}

      <button
        className="
          relative
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          border
          border-white/20
          bg-white/10
          backdrop-blur-2xl
          text-white
          transition-all
          duration-300
          hover:-translate-y-1
          hover:border-orange-400
          hover:bg-orange-500/10
        "
      >
        <Bell size={17} />

        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
      </button>

    </div>
  );
}