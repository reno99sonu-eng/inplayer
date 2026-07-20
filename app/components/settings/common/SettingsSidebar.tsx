"use client";

import { SETTINGS_SECTIONS, type Section } from "./settingsConfig";

interface SettingsSidebarProps {
  active: Section;
  onChange: (section: Section) => void;
}

export default function SettingsSidebar({
  active,
  onChange,
}: SettingsSidebarProps) {
  return (
    <aside
      className="
        hidden
        lg:block
        w-[272px]
        shrink-0
      "
    >
      <div
        className="
          sticky
          top-28
          rounded-[28px]
          border
          border-white/10
          bg-white/[0.025]
          p-2.5
          backdrop-blur-xl
        "
      >
        {SETTINGS_SECTIONS.map((item) => {
          const Icon = item.icon;

          const selected = active === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`
                group
                relative
                mb-1
                flex
                w-full
                items-center
                gap-3
                overflow-hidden
                rounded-2xl
                px-4
                py-3
                text-left
                transition-all
                duration-300
                ease-out
                ${
                  selected
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.035]"
                }
              `}
            >
              {/* A slim accent bar is the only brand-color signal here —
                  deliberately restrained rather than a full gradient
                  fill, per the "keep it premium, not gold-heavy" brief. */}
              <span
                className={`
                  absolute
                  left-0
                  top-1/2
                  h-5
                  w-[3px]
                  -translate-y-1/2
                  rounded-full
                  bg-gradient-to-b
                  from-orange-400
                  to-amber-300
                  transition-opacity
                  duration-300
                  ease-out
                  ${selected ? "opacity-100" : "opacity-0"}
                `}
              />

              <Icon
                size={19}
                className={
                  selected
                    ? "text-white"
                    : "text-slate-400 transition-colors duration-300 ease-out group-hover:text-slate-200"
                }
              />

              <span
                className={
                  selected
                    ? "font-semibold text-white"
                    : "font-medium text-slate-400 transition-colors duration-300 ease-out group-hover:text-slate-200"
                }
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
