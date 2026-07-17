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
  const [notifOpen, setNotifOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Placeholder: no notifications backend wired up yet
  const notifications: { id: string; title: string; time: string }[] = [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }

      if (
        notifRef.current &&
        !notifRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }

    if (open || notifOpen) {
      document.addEventListener("mousedown", handleClick);
    }

    return () =>
      document.removeEventListener("mousedown", handleClick);
  }, [open, notifOpen]);

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

      <div ref={notifRef} className="relative">
        <button
          onClick={() => setNotifOpen(!notifOpen)}
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

          {notifications.length > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>

        <div
          className={`
            absolute
            right-0
            mt-3
            w-[300px]
            overflow-hidden
            rounded-3xl
            border
            border-white/10
            bg-[#08111F]/95
            backdrop-blur-3xl
            shadow-[0_30px_80px_rgba(0,0,0,.55)]
            transition-all
            duration-300
            origin-top-right
            z-[70]
            ${
              notifOpen
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
            }
          `}
        >
          <div className="border-b border-white/10 px-5 py-4">
            <h3 className="text-sm font-black text-white">Notifications</h3>
          </div>

          <div className="max-h-80 overflow-y-auto p-4">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell size={28} className="mb-3 text-slate-500" />
                <p className="text-sm font-semibold text-white">
                  You&apos;re all caught up
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  New notifications will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl bg-white/5 px-3 py-2.5"
                  >
                    <p className="text-sm text-white">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.time}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
