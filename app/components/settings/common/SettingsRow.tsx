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
        ease-out
        hover:border-white/10
        hover:bg-white/[0.035]
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
            ease-out
            ${
              active
                ? "bg-white/10 text-white"
                : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white"
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
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
            {active && (
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            )}
            {value}
          </span>
        )}

        {!children && !value && (
          <ChevronRight
            size={18}
            className="
              text-slate-500
              transition-transform
              duration-300
              ease-out
              group-hover:translate-x-1
            "
          />
        )}

      </div>

    </button>
  );
}
