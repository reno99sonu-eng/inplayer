"use client";

import Link from "next/link";
import { ArrowLeft, Smartphone } from "lucide-react";

// Downloads is intentionally an app-only feature, not offered on the
// website — no nav link on the site points here anymore (see
// app/account/page.tsx, NavbarProfile.tsx, MobileProfileMenu.tsx). This
// page still exists at this URL so anyone who lands here directly (an old
// bookmark, a stale link) gets a clear, honest explanation instead of a
// broken or empty-looking page. The underlying download preparation
// backend (app/api/downloads, app/api/videos/[videoId]/prepare-download)
// is untouched and still real — it's just not linked to from the web UI,
// so it's ready for the InPlayer app to call whenever that's built.
export default function DownloadsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#06101D] light:bg-[#FAF5E9] px-6 text-center text-white light:text-slate-900">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
        <Smartphone size={28} />
      </span>

      <h1 className="mt-6 text-2xl font-black">Downloads are an app feature</h1>

      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400 light:text-slate-600">
        Watching offline isn&apos;t available on the InPlayer website. This
        will be part of the InPlayer app when it launches.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A] px-6 py-3 text-sm font-bold text-white shadow-[0_15px_35px_rgba(255,153,0,.3)] transition-all hover:-translate-y-0.5"
      >
        <ArrowLeft size={16} />
        Back to InPlayer
      </Link>
    </div>
  );
}
