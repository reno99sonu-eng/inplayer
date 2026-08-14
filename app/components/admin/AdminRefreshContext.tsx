"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface AdminRefreshState {
  globalRefreshTrigger: number;
  triggerRefresh: () => void;
  isRefreshing: boolean;
  setRefreshing: (val: boolean) => void;
  lastUpdated: Date | null;
  setLastUpdated: (date: Date) => void;
}

export const AdminRefreshContext = createContext<AdminRefreshState>({
  globalRefreshTrigger: 0,
  triggerRefresh: () => {},
  isRefreshing: false,
  setRefreshing: () => {},
  lastUpdated: null,
  setLastUpdated: () => {},
});

export function AdminRefreshProvider({ children }: { children: ReactNode }) {
  const [globalRefreshTrigger, setGlobalRefreshTrigger] = useState(0);
  const [isRefreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const triggerRefresh = useCallback(() => {
    setGlobalRefreshTrigger((prev) => prev + 1);
  }, []);

  return (
    <AdminRefreshContext.Provider
      value={{
        globalRefreshTrigger,
        triggerRefresh,
        isRefreshing,
        setRefreshing,
        lastUpdated,
        setLastUpdated,
      }}
    >
      {children}
    </AdminRefreshContext.Provider>
  );
}

export function useAdminRefresh(): AdminRefreshState {
  return useContext(AdminRefreshContext);
}
