"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// The real InPlayer/Hammart admin switcher Reno asked for: one Admin
// Panel, two modes, a segmented toggle in AdminHeader flips which items
// AdminSidebar/AdminMobileNav render. Not per-page routing (there's no
// need for a Hammart-only URL prefix) — just which section list is
// visible, same idea as a Gmail-style "Mail / Chat" switcher. Persisted in
// localStorage so it survives a refresh, same convention as ThemeProvider.
export type AdminMode = "inplayer" | "hammart";

const STORAGE_KEY = "inplayer-admin-mode";

interface AdminModeContextValue {
  mode: AdminMode;
  setMode: (mode: AdminMode) => void;
}

const AdminModeContext = createContext<AdminModeContextValue | null>(null);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AdminMode>("inplayer");

  useEffect(() => {
    const readStored = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "hammart" || stored === "inplayer") setModeState(stored);
    };
    readStored();
  }, []);

  const setMode = (next: AdminMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      console.error("Failed to persist admin mode:", err);
    }
  };

  return <AdminModeContext.Provider value={{ mode, setMode }}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode(): AdminModeContextValue {
  const ctx = useContext(AdminModeContext);
  if (!ctx) throw new Error("useAdminMode must be used inside AdminModeProvider");
  return ctx;
}
