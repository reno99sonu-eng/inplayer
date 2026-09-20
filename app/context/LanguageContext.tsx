"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import {
  SUPPORTED_UI_LANGUAGES,
  UI_TRANSLATIONS,
  type TranslationKey,
  type LanguageInfo,
} from "@/app/data/translations";

interface LanguageContextValue {
  language: string;
  setLanguage: (langCode: string) => void;
  t: (key: TranslationKey) => string;
  languages: LanguageInfo[];
  currentLanguageInfo: LanguageInfo;
}

const STORAGE_KEY = "inplayer_language";
const DEFAULT_LANGUAGE = "en";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<string>(DEFAULT_LANGUAGE);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED_UI_LANGUAGES.some((l) => l.code === stored)) {
          setLanguageState(stored);
        } else {
          // Check browser language preference
          const browserLang = navigator.language?.split("-")[0]?.toLowerCase();
          if (browserLang && SUPPORTED_UI_LANGUAGES.some((l) => l.code === browserLang)) {
            setLanguageState(browserLang);
          }
        }
      } catch {
        // Ignore localStorage access errors (e.g. private browsing restrictions)
      }
    })();
  }, []);

  const setLanguage = (newLangCode: string) => {
    const valid = SUPPORTED_UI_LANGUAGES.some((l) => l.code === newLangCode);
    const target = valid ? newLangCode : DEFAULT_LANGUAGE;
    setLanguageState(target);
    try {
      localStorage.setItem(STORAGE_KEY, target);
      // Also write cookie for SSR awareness
      document.cookie = `inplayer_language=${target}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Safe fallback
    }
  };

  const t = useMemo(() => {
    return (key: TranslationKey): string => {
      const langDict = UI_TRANSLATIONS[language] || UI_TRANSLATIONS[DEFAULT_LANGUAGE];
      if (langDict && langDict[key]) {
        return langDict[key];
      }
      return UI_TRANSLATIONS[DEFAULT_LANGUAGE]?.[key] || key;
    };
  }, [language]);

  const currentLanguageInfo = useMemo(() => {
    return (
      SUPPORTED_UI_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_UI_LANGUAGES[0]
    );
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: SUPPORTED_UI_LANGUAGES,
      currentLanguageInfo,
    }),
    [language, t, currentLanguageInfo]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback outside provider
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key: TranslationKey) => UI_TRANSLATIONS[DEFAULT_LANGUAGE]?.[key] || key,
      languages: SUPPORTED_UI_LANGUAGES,
      currentLanguageInfo: SUPPORTED_UI_LANGUAGES[0],
    };
  }
  return context;
}
