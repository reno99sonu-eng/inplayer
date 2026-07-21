"use client";

import {
  Palette,
  Settings,
  PlayCircle,
  Shield,
  CreditCard,
  BarChart3,
  HardDrive,
  Bell,
  Info,
} from "lucide-react";

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

interface SettingsSidebarProps {
  active: Section;
  onChange: (section: Section) => void;
}

const items = [
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
  },
  {
    id: "general",
    label: "General",
    icon: Settings,
  },
  {
    id: "playback",
    label: "Playback",
    icon: PlayCircle,
  },
  {
    id: "privacy",
    label: "Account & Privacy",
    icon: Shield,
  },
  {
    id: "payments",
    label: "Plans & Purchases",
    icon: CreditCard,
  },
  {
    id: "analytics",
    label: "User Analytics",
    icon: BarChart3,
  },
  {
    id: "storage",
    label: "Storage",
    icon: HardDrive,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    id: "about",
    label: "About",
    icon: Info,
  },
] as const;

export default function SettingsSidebar({
  active,
  onChange,
}: SettingsSidebarProps) {
  return (
    <aside
      className="
        hidden
        lg:block
        w-[280px]
        shrink-0
      "
    >
      <div
        className="
          sticky
          top-28
          rounded-[28px]
          border
          border-white/10 light:border-black/10
          bg-white/[0.03] light:bg-black/[0.03]
          p-3
          backdrop-blur-xl
        "
      >
        {items.map((item) => {
          const Icon = item.icon;

          const selected = active === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`
                mb-2
                flex
                w-full
                items-center
                gap-3
                rounded-2xl
                px-4
                py-3
                text-left
                transition-all
                duration-300
                ${
                  selected
                    ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 border border-orange-400/30"
                    : "hover:bg-white/5 light:hover:bg-black/5"
                }
              `}
            >
              <Icon
                size={20}
                className={
                  selected
                    ? "text-orange-300"
                    : "text-slate-400 light:text-slate-600"
                }
              />

              <span
                className={
                  selected
                    ? "font-bold text-white light:text-slate-900"
                    : "font-medium text-slate-300 light:text-slate-700"
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