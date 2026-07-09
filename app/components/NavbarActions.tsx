"use client";

import {
  Bell,
  Crown,
  Plus,
} from "lucide-react";

export default function NavbarActions() {
  return (
    <div className="hidden lg:flex items-center gap-2">

      {/* Create */}

      <button
        className="
          flex
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
          shadow-lg
          transition-all
          duration-300
          hover:-translate-y-1
          hover:scale-105
        "
      >
        <Plus size={18} />
        Create
      </button>

      {/* Premium */}

      <button
        className="
          flex
          items-center
          gap-2
          rounded-full
          border
          border-amber-300/40
          bg-white/80
          backdrop-blur-xl
          px-4
          py-3
          text-sm
          font-semibold
          transition-all
          duration-300
          hover:bg-amber-50
        "
      >
        <Crown size={17} className="text-amber-500" />
        Premium
      </button>

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
          border-white/40
          bg-white/80
          backdrop-blur-xl
          transition-all
          duration-300
          hover:-translate-y-1
          hover:shadow-lg
        "
      >
        <Bell size={17} />

        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
      </button>

    </div>
  );
}