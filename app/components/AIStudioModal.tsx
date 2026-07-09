"use client";

import { useEffect, useState } from "react";

interface AIStudioModalProps {
  open: boolean;
  onClose: () => void;
}

const prompts = [
  "Create a cinematic travel documentary...",
  "Generate a YouTube gaming thumbnail...",
  "Write a podcast introduction...",
  "Translate this video into 12 languages...",
  "Create a luxury movie trailer...",
];

export default function AIStudioModal({
  open,
  onClose,
}: AIStudioModalProps) {
  const [placeholder, setPlaceholder] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;

    let i = 0;
    const text = prompts[index];

    const typing = setInterval(() => {
      i++;

      setPlaceholder(text.slice(0, i));

      if (i >= text.length) {
        clearInterval(typing);

        setTimeout(() => {
          setPlaceholder("");
          setIndex((prev) => (prev + 1) % prompts.length);
        }, 1800);
      }
    }, 35);

    return () => clearInterval(typing);
  }, [index, open]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/10 backdrop-blur-[2px]"
    >
      <div
  onClick={(e) => e.stopPropagation()}
  className="
    absolute
    right-6
    bottom-24
    w-[360px]
    overflow-hidden
    rounded-[30px]
    border
    border-orange-400/15
    bg-gradient-to-br
    from-[#07111F]/95
    via-[#0B1728]/95
    to-[#040A14]/95
    p-4
    backdrop-blur-3xl
    shadow-[0_25px_90px_rgba(0,0,0,.55)]
    animate-aiPopup
"
>
<div className="pointer-events-none absolute inset-0">

  <div
    className="
      absolute
      -left-24
      -top-20
      h-56
      w-56
      rounded-full
      bg-orange-500/10
      blur-[90px]
    "
  />

  <div
    className="
      absolute
      -right-20
      bottom-0
      h-48
      w-48
      rounded-full
      bg-cyan-500/10
      blur-[90px]
    "
  />

  <div
    className="
      absolute
      inset-0
      bg-[linear-gradient(to_bottom,rgba(255,255,255,.05),transparent)]
    "
  />

</div>
        <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onClose();
  }}
  className="
    absolute
    right-4
    top-4
    z-50
    flex
    h-10
    w-10
    items-center
    justify-center
    rounded-full
    border
    border-white/10
    bg-[#131C2D]
    text-slate-300
    transition-all
    duration-300
    hover:rotate-90
    hover:border-orange-400/40
    hover:bg-orange-500/10
    hover:text-white
  "
>
  ✕
</button>

        <div className="relative z-10">

  <div className="flex items-center">

  <span className="rounded-full border border-orange-400/30 bg-gradient-to-r from-orange-500/15 to-amber-400/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.4em] text-orange-200 shadow-[0_0_20px_rgba(251,146,60,.15)]">
    INPLAYER AI
  </span>

</div>
  <h2 className="mt-3 text-[28px] font-black leading-none tracking-tight text-white">

    Create
    <br />
    Smarter.

  </h2>

  <p className="mt-2 text-[12px] leading-6 text-slate-400">

    Generate premium scripts, thumbnails,
    voiceovers and translations instantly.

  </p>
  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">

  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />

  <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-emerald-300">
    AI ONLINE
  </span>

</div>

</div>

<div className="mt-3 rounded-[22px] border border-white/10 bg-white/[0.045] p-3 backdrop-blur-xl">

  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">

    AI PROMPT

  </p>

  <div className="rounded-2xl border border-white/10 bg-[#07111F] p-3 shadow-inner">

    <textarea
      rows={1}
      readOnly
      value={`${placeholder}|`}
      className="
       h-12
        w-full
        resize-none
        bg-transparent
        text-[14px]
        leading-7
        text-white
        outline-none
      "
    />

  </div>

  <button
    className="
      mt-4
      w-full
      rounded-2xl
      bg-gradient-to-r
      from-[#FF7A18]
      via-[#FF9A00]
      to-[#FFD54A]
      py-2
      text-sm
      font-bold
      tracking-wide
      text-white
      shadow-[0_15px_35px_rgba(255,153,0,.35)]
      transition-all
      duration-300
      hover:-translate-y-0.5
      ...hover:shadow-[0_20px_50px_rgba(255,153,0,.45)]
    "
>
      Generate Content
    </button>

</div>
        <div className="mt-3">

          <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-slate-500">
            Quick Tools
          </p>

          <div className="grid grid-cols-2 gap-2">

            {[
              "Scripts",
              "Thumbnails",
              "Voice",
              "Translate",
            ].map((tool) => (
              <button
                key={tool}
                className="
                  rounded-xl
                  border
                  border-white/5
                  bg-white/[0.04]
                  py-2
                  text-xs
                  font-medium
                  text-slate-300
                  transition
                  hover:border-orange-400/40
                  hover:bg-orange-500/10
                  hover:text-white
                "
              >
                {tool}
              </button>
            ))}

          </div>

        </div>

      </div>
    </div>
  );
}