"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Video, Radio, Mic2, Sparkles } from "lucide-react";

import CreatePopup from "./CreatePopup";
import AIStudioModal from "./AIStudioModal";

export default function MobileCreateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const items = [
    {
      icon: <Video size={20} />,
      title: "Upload Video",
      subtitle: "Movies • Shorts • Series",
      color: "from-red-500 to-orange-500",
      onClick: () => go("/upload"),
    },
    {
      icon: <Radio size={20} />,
      title: "Go Live",
      subtitle: "Streaming & Events",
      color: "from-orange-500 to-amber-400",
      onClick: () => go("/live"),
    },
    {
      icon: <Mic2 size={20} />,
      title: "Podcast",
      subtitle: "Voice & Audio Shows",
      color: "from-cyan-500 to-sky-400",
      onClick: () => {
        // Preselect the Podcasts category on the upload page.
        try {
          sessionStorage.setItem("inplayer-upload-preset", "podcast");
        } catch {
          /* ignore */
        }
        go("/upload");
      },
    },
    {
      icon: <Sparkles size={20} />,
      title: "AI Studio",
      subtitle: "Generate with AI",
      color: "from-violet-500 to-fuchsia-500",
      onClick: () => {
        setOpen(false);
        setAiOpen(true);
      },
    },
  ];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Create"
        className="
          flex
          h-10
          w-10
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

      <CreatePopup open={open} popupRef={popupRef} items={items} mobile />

      <AIStudioModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
