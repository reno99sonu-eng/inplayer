"use client";

type Section =
  | "appearance"
  | "general"
  | "playback"
  | "privacy"
  | "payments"
  | "analytics"
  | "storage"
  | "notifications"
  | "about";

interface MobileSettingsTabsProps {
  active: Section;
  onChange: (section: Section) => void;
}

const tabs = [
  { id: "appearance", label: "Appearance" },
  { id: "general", label: "General" },
  { id: "playback", label: "Playback" },
  { id: "privacy", label: "Privacy" },
  { id: "payments", label: "Plans" },
  { id: "analytics", label: "Analytics" },
  { id: "storage", label: "Storage" },
  { id: "notifications", label: "Alerts" },
  { id: "about", label: "About" },
] as const;

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
        <div className="flex min-w-max gap-3 px-1 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`
                shrink-0
                whitespace-nowrap
                rounded-full
                px-5
                py-2.5
                text-sm
                font-semibold
                transition-all
                duration-300
                ${
                  active === tab.id
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white light:text-slate-900 shadow-lg shadow-orange-500/20"
                    : "bg-white/[0.04] light:bg-black/[0.04] text-slate-300 light:text-slate-700 hover:bg-white/[0.08] light:hover:bg-black/[0.08] light:bg-black/[0.04] light:text-slate-600 light:hover:bg-black/[0.08]"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
