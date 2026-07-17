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

function resolveTheme(theme: ThemeChoice): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
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
      (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ??
      "system";

    setThemeState(saved);
    applyTheme(saved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const handleThemeChange = () => {
      const current =
        (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ??
        "system";

      if (current === "system") {
        applyTheme("system");
      }
    };

    if (media.addEventListener) {
      media.addEventListener("change", handleThemeChange);
    } else {
      media.addListener(handleThemeChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleThemeChange);
      } else {
        media.removeListener(handleThemeChange);
      }
    };
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