"use client";

import { Plus } from "lucide-react";

export default function MobileCreateButton() {
  return (
    <button
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
      <Plus size={18} strokeWidth={2.8} />
    </button>
  );
}