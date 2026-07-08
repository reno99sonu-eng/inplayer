"use client";

import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

export default function Button({
  children,
  variant = "primary",
  className = "",
}: ButtonProps) {
  const styles = {
    primary:
      "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-[0_15px_35px_rgba(249,115,22,0.35)] hover:scale-[1.03] hover:-translate-y-1",

    secondary:
      "bg-white/80 backdrop-blur-xl border border-white/40 text-slate-900 hover:bg-white",

    ghost:
      "bg-transparent border border-white/20 text-white hover:bg-white/10",
  };

  return (
    <button
      className={`
        inline-flex
        items-center
        justify-center
        rounded-full
        px-7
        py-4
        font-semibold
        transition-all
        duration-300
        ${styles[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}