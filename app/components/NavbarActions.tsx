"use client";

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
  onClick={() => setOpen(!open)}
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

      <div
        ref={popupRef}
        className={`
          absolute
          right-14
          top-16
          w-[320px]
          overflow-hidden
          rounded-3xl
          border
          border-orange-400/20
          bg-[#08111F]/95
          backdrop-blur-3xl
          shadow-[0_30px_80px_rgba(0,0,0,.55)]
          transition-all
          duration-300
          ${
            open
              ? "translate-y-0 opacity-100 pointer-events-auto"
              : "-translate-y-4 opacity-0 pointer-events-none"
          }
        `}
      >

        <div className="border-b border-white/10 p-5">

          <h3 className="text-lg font-black text-white">
            Create
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            Start creating on InPlayer
          </p>

        </div>

        <div className="p-3">

          {items.map((item) => (

            <button
  type="button"
              key={item.title}
              className="
group
mb-2
flex
w-full
items-center
gap-4
rounded-2xl
border
border-transparent
p-4
text-left
transition-all
duration-300
hover:border-orange-400/20
hover:bg-white/5
hover:translate-x-1
hover:shadow-[0_0_30px_rgba(249,115,22,.18)]
"
            >

<div
  className={`
    flex
    h-12
    w-12
    items-center
    justify-center
    rounded-2xl
    bg-gradient-to-br
    ${item.color}
    text-white
    shadow-lg
    transition-all
    duration-300
    group-hover:scale-110
    group-hover:rotate-6
  `}
>
  {item.icon}
</div>

              <div>

                <div className="font-semibold text-white">
                  {item.title}
                </div>

                <div className="text-xs text-slate-400">
                  {item.subtitle}
                </div>

              </div>

            </button>

          ))}

        </div>

      </div>

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