"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Globe, Sparkles } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";

export default function LanguageSettingsPage() {
  const { language, setLanguage, languages, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#06101D] text-white px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation header */}
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label="Back to Settings"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Globe className="text-orange-500" size={24} />
              {t("settings_language")}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {t("settings_language_desc")}
            </p>
          </div>
        </div>

        {/* Bhashini Info Banner */}
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20">
          <Sparkles className="text-orange-400 shrink-0" size={22} />
          <div className="text-xs sm:text-sm text-slate-300">
            <span className="font-semibold text-orange-400">MeitY Bhashini Powered: </span>
            InPlayer UI and regional subtitles support 11 Scheduled Indian Languages with native Indian language processing.
          </div>
        </div>

        {/* Language Selection Grid */}
        <div className="bg-[#0b1728] border border-slate-800/80 rounded-2xl p-4 sm:p-6 shadow-xl space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
            {t("settings_select_language")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {languages.map((item) => {
              const isSelected = language === item.code;
              return (
                <button
                  key={item.code}
                  onClick={() => setLanguage(item.code)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                    isSelected
                      ? "bg-orange-500/15 border-orange-500 text-white shadow-lg shadow-orange-500/10"
                      : "bg-slate-900/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-base flex items-center gap-2">
                      {item.nativeName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {item.name}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0">
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Return Button */}
        <div className="pt-2 flex justify-end">
          <Link
            href="/settings"
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
          >
            {t("action_done")}
          </Link>
        </div>
      </div>
    </div>
  );
}
