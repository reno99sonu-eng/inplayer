"use client";

import { useAuthModal } from "@/app/components/auth/AuthProvider";

export function useAuth() {
  const { user, authLoading, signedIn, signOut } = useAuthModal();

  return {
    user,
    loading: authLoading,
    signedIn,
    signOut,
  };
}