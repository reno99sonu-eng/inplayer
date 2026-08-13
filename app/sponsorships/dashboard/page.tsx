"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SponsorshipDashboardPanel from "@/app/components/sponsorships/SponsorshipDashboardPanel";

// Kept as its own real route (not just folded into the /sponsorships tab
// panel) so any link/bookmark/email pointing here — including the
// "Go to My Sponsorships" button on a fresh checkout confirmation, see
// app/sponsorships/page.tsx — keeps working exactly as before. Same
// content as the "My Dashboard" tab inside /sponsorships itself; both
// render the one shared SponsorshipDashboardPanel so there's no risk of
// the two ever drifting out of sync.
export default function SponsorshipDashboardPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/sponsorships" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white light:text-slate-600 light:hover:text-slate-900">
        <ArrowLeft size={14} /> Back to sponsorship packages
      </Link>

      <h1 className="text-xl font-black text-white light:text-slate-900 sm:text-2xl">My Sponsorships</h1>
      <p className="mt-1 text-xs text-slate-400 light:text-slate-600 sm:text-sm">
        Every ad campaign you've purchased on InPlayer, with real views and clicks once it's live.
      </p>

      <div className="mt-5">
        <SponsorshipDashboardPanel />
      </div>
    </div>
  );
}
