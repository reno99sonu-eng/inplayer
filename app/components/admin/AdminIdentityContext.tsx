"use client";

import { createContext, useContext, ReactNode } from "react";

// Purely informational client-side view of "what can this signed-in admin
// identity see in the UI" — main admin (full access) or a team member
// (only their granted permission strings, from InPlayer-Admin-Members via
// GET /api/admin/me). This drives which sidebar links render; it is NOT
// itself an authorization boundary — every route the sidebar links to
// re-checks with requireAdmin()/requirePermission() server-side
// regardless of what this context says (see app/lib/isAdmin.ts).
interface AdminIdentityContextValue {
  isMainAdmin: boolean;
  permissions: Set<string>;
}

const AdminIdentityContext = createContext<AdminIdentityContextValue>({
  isMainAdmin: false,
  permissions: new Set(),
});

export function AdminIdentityProvider({
  isMainAdmin,
  permissions,
  children,
}: {
  isMainAdmin: boolean;
  permissions: string[];
  children: ReactNode;
}) {
  return (
    <AdminIdentityContext.Provider value={{ isMainAdmin, permissions: new Set(permissions) }}>
      {children}
    </AdminIdentityContext.Provider>
  );
}

export function useAdminIdentity(): AdminIdentityContextValue {
  return useContext(AdminIdentityContext);
}
