"use client";

import Link from "next/link";
import { ChevronRight, Globe } from "lucide-react";
import SettingsCard from "../common/SettingsCard";
import { useLanguage } from "@/app/context/LanguageContext";

export default function GeneralSection() {
  const { language, setLanguage, languages, currentLanguageInfo, t } = useLanguage();

  return (
    <SettingsCard
      icon={<Globe size={24} />}
      title={t("settings_title")}
      description="Personalize your overall InPlayer experience."
    >
      <div className="space-y-4">
        <Link
          href="/settings/language"
          className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform">
              <Globe size={20} />
            </div>
            <div>
              <div className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                {t("settings_language")}
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-medium">
                  {currentLanguageInfo.nativeName}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {t("settings_language_desc")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-400 group-hover:text-white transition-colors">
            <span className="text-sm font-medium hidden sm:inline">
              {currentLanguageInfo.name}
            </span>
            <ChevronRight size={18} />
          </div>
        </Link>

        {/* Quick Language Switcher Bar */}
        <div className="pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
            {t("settings_select_language")}
          </div>
          <div className="flex flex-wrap gap-2">
            {languages.slice(0, 6).map((item) => (
              <button
                key={item.code}
                onClick={() => setLanguage(item.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  language === item.code
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-slate-900/60 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                {item.nativeName}
              </button>
            ))}
            <Link
              href="/settings/language"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-orange-400 border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              + {languages.length - 6} more
            </Link>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}