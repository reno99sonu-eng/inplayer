"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /admin has nothing of its own to show — it just sends you to the
// Dashboard, the same way visiting a bare /settings would.
export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return null;
}
