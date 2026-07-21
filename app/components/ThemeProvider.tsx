"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type ThemeChoice = "system" | "light" | "dark";

interface ThemeContextValue {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "inplayer-theme";

// Daytime window for the automatic theme: light from 6:00 to 17:59 local
// time, dark otherwise. Must stay in sync with the pre-hydration script in
// app/layout.tsx, which applies the same rule before first paint.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;

function resolveTheme(theme: ThemeChoice): "light" | "dark" {
  if (theme === "system") {
    // "Auto" follows the local TIME OF DAY (light by day, dark at night),
    // not the OS appearance — so a first-time visitor with no saved
    // preference gets a theme matching when they're visiting, signed in
    // or not.
    const hour = new Date().getHours();
    return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? "light" : "dark";
  }

  return theme;
}

function applyTheme(theme: ThemeChoice) {
  const resolved = resolveTheme(theme);

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    const saved =
      (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? "system";

    setThemeState(saved);
    applyTheme(saved);

    // While in Auto mode, re-check every minute so the theme flips on its
    // own when the local time crosses the day/night boundary — even if the
    // tab has been open for hours.
    const interval = setInterval(() => {
      const current =
        (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? "system";

      if (current === "system") {
        applyTheme("system");
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const setTheme = (newTheme: ThemeChoice) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}
