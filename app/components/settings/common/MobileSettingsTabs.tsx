"use client";

import { SETTINGS_SECTIONS, type Section } from "./settingsConfig";

interface MobileSettingsTabsProps {
  active: Section;
  onChange: (section: Section) => void;
}

export default function MobileSettingsTabs({
  active,
  onChange,
}: MobileSettingsTabsProps) {
  return (
    <div className="lg:hidden mb-6 overflow-hidden">
      {/* Inner div extends 24px past the visible area (where any native
          scrollbar/indicator renders), then a matching negative margin
          pulls it back up — the parent's overflow-hidden physically clips
          that extra strip away. This hides scrollbars even on platforms
          where scrollbar-width/::-webkit-scrollbar CSS has no effect. */}
      <div
        className="
          overflow-x-auto
          overflow-y-hidden
          touch-pan-x
          overscroll-x-contain
          pb-6
          -mb-6
          [-ms-overflow-style:none]
          [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
        "
      >
        <div className="flex min-w-max gap-2 px-1 pb-1">
          {SETTINGS_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`
                shrink-0
                whitespace-nowrap
                rounded-full
                px-4
                py-2.5
                text-sm
                font-semibold
                transition-all
                duration-300
                ease-out
                ${
                  active === item.id
                    ? "bg-white text-[#06101D] shadow-lg shadow-black/20 light:bg-slate-900 light:text-white"
                    : "bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] light:bg-black/[0.04] light:text-slate-600 light:hover:bg-black/[0.08]"
                }
              `}
            >
              {item.mobileLabel || item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
