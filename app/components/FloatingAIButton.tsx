"use client";

import { useState } from "react";
import AIStudioModal from "./AIStudioModal";

export default function FloatingAIButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
  type="button"
  onClick={() => setOpen(true)}
  aria-label="Open AI Studio"
  className="
    group
    fixed
    bottom-8
    right-8
    z-[9998]
    flex
    h-16
    w-16
    items-center
    justify-center
    overflow-hidden
    rounded-full
    border
    border-orange-400/20
    bg-gradient-to-br
    from-[#111C2D]
    via-[#0C1626]
    to-[#060C16]
    backdrop-blur-xl
    transition-all
    duration-500
    hover:scale-105
    animate-aiOrbFloat
    animate-aiGlow
  "
>
  {/* Static Glass Reflection */}

<div
  className="
    pointer-events-none
    absolute
    inset-0
    rounded-full
    bg-[linear-gradient(135deg,rgba(255,255,255,.18),transparent_45%)]
  "
/>

{/* Moving Glass Sweep */}

<div
  className="
    pointer-events-none
    absolute
    -left-8
    top-0
    h-full
    w-5
    rotate-12
    bg-white/25
    blur-sm
    animate-aiGlassSweep
  "
/>

  {/* Premium AI Spark */}

  <span
    className="
      relative
      z-10
      text-[26px]
      text-[#FFD66B]
      animate-aiSparkle
      select-none
    "
  >
    ✦
  </span>

</button>

      <AIStudioModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}