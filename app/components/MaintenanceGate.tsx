"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Wrench, ShieldAlert } from "lucide-react";
import { usePlatformSettings } from "@/app/hooks/usePlatformSettings";
import { getSiteDomain, getDomainMaintenance, type DomainMaintenanceFields } from "@/app/lib/siteDomain";

// Real maintenance mode & Emergency Project Block — flip it on from Admin Panel -> Platform Settings
// and EVERY visitor sees the splash screen.
// /admin remains accessible so the admin can always sign in and manage settings.
export default function MaintenanceGate({
  children,
  initialMaintenance,
  initialProjectBlocked,
  initialProjectBlockedMessage,
}: {
  children: ReactNode;
  initialMaintenance: DomainMaintenanceFields;
  initialProjectBlocked?: boolean;
  initialProjectBlockedMessage?: string;
}) {
  const pathname = usePathname();
  const domain = getSiteDomain(pathname);
  const { settings, loading: settingsLoading } = usePlatformSettings();

  // Emergency Project Block (Kill Switch) — blocks all public services across web and app
  const isProjectBlocked = settingsLoading
    ? Boolean(initialProjectBlocked)
    : (settings?.projectBlocked ?? Boolean(initialProjectBlocked));
  const projectBlockedMessage = settingsLoading
    ? (initialProjectBlockedMessage || "The project has been removed")
    : (settings?.projectBlockedMessage || initialProjectBlockedMessage || "The project has been removed");

  if (isProjectBlocked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#06101D] px-6 text-center select-none light:bg-[#F5EEDC]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 shadow-lg shadow-red-500/10">
          <ShieldAlert size={32} className="text-red-400" />
        </div>
        <h1 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight text-white light:text-slate-900">
          The project has been removed
        </h1>
        <p className="mt-2.5 max-w-sm text-sm text-slate-400 light:text-slate-600">
          {projectBlockedMessage !== "The project has been removed"
            ? projectBlockedMessage
            : "This service is currently unavailable."}
        </p>
        <Link
          href="/admin"
          className="mt-12 text-xs text-slate-600 hover:text-slate-400 light:text-slate-400 light:hover:text-slate-600 transition-colors"
        >
          Admin Portal
        </Link>
      </div>
    );
  }

  const initial = getDomainMaintenance(initialMaintenance, domain);
  const maintenanceOn = settingsLoading ? initial.mode : Boolean(settings && getDomainMaintenance(settings, domain).mode);
  const maintenanceMessage = settingsLoading
    ? initial.message
    : (settings && getDomainMaintenance(settings, domain).message) || initial.message;

  // Maintenance fully off — render normally, no gate at all.
  if (!maintenanceOn) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#06101D] px-6 text-center light:bg-[#F5EEDC]">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10">
        <Wrench size={28} className="text-orange-300" />
      </div>
      <h1 className="mt-5 text-2xl font-black text-white light:text-slate-900">
        Be right back
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400 light:text-slate-600">
        {maintenanceMessage ||
          "InPlayer is down for scheduled maintenance. We'll be back shortly."}
      </p>
    </div>
  );
}
