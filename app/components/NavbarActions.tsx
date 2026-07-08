"use client";

import {
  Bell,
  Crown,
  Settings,
} from "lucide-react";

export default function NavbarActions() {
  return (
    <div className="hidden lg:flex items-center gap-3">

      {/* Premium */}

      <button
        className="
          flex
          items-center
          gap-2
          rounded-full
          bg-gradient-to-r
          from-amber-400
          via-yellow-400
          to-orange-400
          px-6
          py-3
          text-[14px]
          font-bold
          text-slate-900
          shadow-lg
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:shadow-xl
        "
      >
        <Crown size={16} />

        Premium
      </button>

      {/* Notifications */}

      <button
        className="
          relative
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-full
          border
          border-slate-200
          bg-white/90
          shadow-sm
          transition-all
          duration-300
          hover:-translate-y-1
          hover:shadow-lg
        "
      >
        <Bell size={18} />

        <span
          className="
            absolute
            right-3
            top-3
            h-2
            w-2
            rounded-full
            bg-red-500
          "
        />
      </button>

      {/* Settings */}

      <button
        className="
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-full
          border
          border-slate-200
          bg-white/90
          shadow-sm
          transition-all
          duration-300
          hover:-translate-y-1
          hover:rotate-45
          hover:shadow-lg
        "
      >
        <Settings size={18} />
      </button>

      {/* Login */}

      <button
        className="
          rounded-full
          border
          border-slate-300
          bg-white/90
          px-6
          py-3
          font-semibold
          text-slate-700
          transition-all
          duration-300
          hover:border-orange-300
          hover:text-orange-500
        "
      >
        Login
      </button>

      {/* Sign Up */}

      <button
        className="
          rounded-full
          bg-[#0F172A]
          px-6
          py-3
          font-semibold
          text-white
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:bg-black
          hover:shadow-xl
        "
      >
        Sign Up
      </button>

    </div>
  );
}