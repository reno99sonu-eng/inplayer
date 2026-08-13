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
// effects. Platform Settings, AI Moderation, Error Logs, and Bug Reports
// are all reachable from more than one mode at the same /admin/... URL,
// but each of those pages is itself mode-aware and reads/writes only that
// panel's own fields (inplayerMaintenanceMode vs hammartMaintenanceMode,
// etc — see app/lib/platformSettings.ts and app/lib/siteDomain.ts). That
// used to NOT be true for maintenance mode and the announcement banner —
// they were one flat global toggle each, so turning on Hammart's
// maintenance mode also took down InPlayer and Sponsorship, which is
// exactly the bug Reno reported. Audit Logs is the one genuine shared
// exception: a read-only history of every admin action across all three
// modes, since viewing it never changes anything and an admin action taken
// from any panel is worth showing everywhere.
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
