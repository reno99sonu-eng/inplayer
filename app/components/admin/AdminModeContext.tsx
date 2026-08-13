"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// The real InPlayer/Hammart/Sponsorship admin switcher Reno asked for: one
// Admin Panel, three fully independent modes, a segmented toggle in
// AdminHeader flips which items AdminSidebar/AdminMobileNav render. Not
// per-page routing (there's no need for a mode-specific URL prefix) — just
// which section list is visible, same idea as a Gmail-style "Mail / Chat"
// switcher. Persisted in localStorage so it survives a refresh, same
// convention as ThemeProvider.
//
// "Independent" means each mode's own sidebar only ever lists that
// domain's own pages/tables (Hammart's vendors/products/orders, InPlayer's
// videos/users/revenue, Sponsorship's ad-sales/house-ads) — nothing one
// mode does writes to data another mode reads, so flipping this switch is
// purely cosmetic/navigational, never a source of cross-domain side
// effects. Platform Settings and Audit Logs are the two deliberate
// exceptions, reachable from every mode: Settings holds genuinely
// site-wide toggles (maintenance mode, sign-ups, the announcement banner)
// that are SUPPOSED to affect the whole site regardless of which mode you
// opened them from, and Audit Logs is a read-only history of every admin
// action across all three modes — viewing it never changes anything.
export type AdminMode = "inplayer" | "hammart" | "sponsorship";

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
      if (stored === "hammart" || stored === "inplayer" || stored === "sponsorship") setModeState(stored);
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
