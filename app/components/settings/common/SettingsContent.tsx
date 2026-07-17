"use client";

import { ReactNode } from "react";
import PlaybackSection from "../sections/PlaybackSection";
import PrivacySection from "../sections/PrivacySection";

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

interface SettingsContentProps {
  active: Section;
  appearance: ReactNode;
  general: ReactNode;
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-[#101826] p-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-5 inline-flex rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
          Coming Soon
        </div>

        <h2 className="text-3xl font-black text-white">
          {title}
        </h2>

        <p className="mt-4 text-base leading-7 text-slate-400">
          This section is currently being built and will be available in the
          next phase of the Settings redesign.
        </p>
      </div>
    </div>
  );
}

export default function SettingsContent({
  active,
  appearance,
  general,
}: SettingsContentProps) {
  switch (active) {
    case "appearance":
      return appearance;

    case "general":
      return general;

      case "playback":
        return <PlaybackSection />;

        case "privacy":
          return <PrivacySection />;

    case "payments":
      return <ComingSoon title="Plans & Purchases" />;

    case "analytics":
      return <ComingSoon title="User Analytics" />;

    case "storage":
      return <ComingSoon title="Storage" />;

    case "notifications":
      return <ComingSoon title="Notifications" />;

    case "about":
      return <ComingSoon title="About InPlayer" />;

    default:
      return appearance;
  }
}