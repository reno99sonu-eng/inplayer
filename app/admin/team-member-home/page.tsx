"use client";

import { ShieldQuestion } from "lucide-react";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

// Landing page for a team member whose granted permissions don't map to
// any sidebar destination — right now that's "view_reports" and
// "delete_stuck_processing_videos", offered in the invite form
// (app/admin/team/page.tsx) but with no dedicated page built for either
// one yet. Without this, /admin/page.tsx's redirect would have nowhere
// safe to send them and would 404. Not a dead end forever — once those
// two permissions get a real page, add them to FIRST_ACCESSIBLE_ROUTE in
// app/admin/page.tsx and this page stops being anyone's landing spot.
export default function TeamMemberHomePage() {
  const { user } = useAuthModal();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/10">
        <ShieldQuestion size={26} className="text-indigo-300" />
      </div>
      <h2 className="mt-4 text-2xl font-black text-white light:text-slate-900">
        Nothing to show yet
      </h2>
      <p className="mt-2 max-w-md text-sm text-slate-400 light:text-slate-600">
        {user?.email || "This account"} doesn&apos;t have any permissions with their own
        admin page yet. Ask the main admin to grant you access to a section like Support,
        Bug Reports, Error Logs, Navbar Theme, or Advertising.
      </p>
    </div>
  );
}
