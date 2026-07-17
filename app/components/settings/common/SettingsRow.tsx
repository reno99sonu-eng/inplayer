"use client";

import { ChevronRight } from "lucide-react";
import { ReactNode } from "react";

interface SettingsRowProps {
  icon: ReactNode;
  title: string;
  description?: string;
  value?: string;
  active?: boolean;
  children?: ReactNode;
  onClick?: () => void;
}

export default function SettingsRow({
  icon,
  title,
  description,
  value,
  active = false,
  children,
  onClick,
}: SettingsRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        flex
        w-full
        items-center
        justify-between
        rounded-2xl
        border
        border-transparent
        px-5
        py-4
        text-left
        transition-all
        duration-300
        hover:border-orange-400/20
        hover:bg-white/[0.04]
        hover:-translate-y-0.5
      "
    >
      <div className="flex items-center gap-4">

        <div
          className={`
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            transition-all
            duration-300
            ${
              active
                ? "bg-orange-500/20 text-orange-300"
                : "bg-white/5 text-slate-300 group-hover:bg-orange-500/10 group-hover:text-orange-300"
            }
          `}
        >
          {icon}
        </div>

        <div>

          <h3 className="text-[16px] font-bold text-white">
            {title}
          </h3>

          {description && (
            <p className="mt-1 text-sm text-slate-400">
              {description}
            </p>
          )}

        </div>

      </div>

      <div className="flex items-center gap-3">

        {children}

        {value && (
          <span className="text-sm font-medium text-orange-300">
            {value}
          </span>
        )}

        {!children && (
          <ChevronRight
            size={18}
            className="
              text-slate-500
              transition-transform
              duration-300
              group-hover:translate-x-1
            "
          />
        )}

      </div>

    </button>
  );
}