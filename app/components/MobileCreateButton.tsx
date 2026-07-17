"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Video,
  Radio,
  Mic2,
  Sparkles,
} from "lucide-react";

import CreatePopup from "./CreatePopup";

export default function MobileCreateButton() {
  const [open, setOpen] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;

      if (
        popupRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
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
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-full
          bg-gradient-to-r
          from-orange-500
          via-amber-400
          to-yellow-400
          text-slate-900
          shadow-xl
          transition-all
          duration-300
          hover:scale-105
        "
      >
        <Plus
          size={18}
          strokeWidth={2.8}
          className={`transition-transform duration-300 ${
            open ? "rotate-45" : "rotate-0"
          }`}
        />
      </button>

      <CreatePopup
  open={open}
  popupRef={popupRef}
  items={items}
  mobile={typeof window !== "undefined" && window.innerWidth < 1024}
/>
    </div>
  );
}