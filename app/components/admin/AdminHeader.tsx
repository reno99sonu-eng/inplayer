"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "@/app/components/ThemeProvider";
import { useAuthModal } from "@/app/components/auth/AuthProvider";

// The Admin Panel's own dedicated header — deliberately NOT the public
// site's Navbar (no search bar, no category bar, no "Your Channel"/
// subscriptions drawer; see app/components/SiteChrome.tsx for where that
// split happens). Keeps the real INPLAYER logo (same two theme-swapped
// PNGs NavbarLogo.tsx uses) so the admin panel still reads as InPlayer,
// but everything else here is admin-only: a manual light/dark toggle and
// Sign Out, since neither is reachable from the public navbar anymore
// once you're inside /admin/*.
export default function AdminHeader({ email }: { email: string | null }) {
  const { setTheme } = useTheme();
  const { signOut } = useAuthModal();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const readTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    readTheme();
  }, []);

  // Sets an explicit light/dark choice (bypassing "Auto") — the same
  // direct setTheme() call the Settings page's own Light/Dark options use
  // (see app/components/settings/sections/AppearanceSection.tsx). "Auto"
  // is still available from there if an admin wants it back.
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    setIsDark(!isDark);
  };

  return (
    <header className="relative overflow-hidden border-b border-white/10 light:border-black/10">
      <h1
        className="
          pointer-events-none
          absolute
          left-4
          top-2
          select-none
          text-[80px]
          font-black
          tracking-[-0.08em]
          text-white/[0.025] light:text-black/[0.04]
          lg:left-8
          lg:text-[140px]
        "
      >
        ADMIN
      </h1>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-5 py-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            aria-label="Admin Panel — Dashboard"
            className="flex-shrink-0 transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            <img
              src="/logos/inplayer-mark-dark.png"
              alt="INPLAYER"
              draggable={false}
              className="light:hidden h-8 w-auto object-contain"
            />
            <img
              src="/logos/inplayer-mark-light.png"
              alt="INPLAYER"
              draggable={false}
              className="hidden light:block h-8 w-auto object-contain"
            />
          </Link>

          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/10">
            <ShieldCheck size={20} className="text-indigo-300" />
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-white light:text-slate-900 sm:text-3xl">
              Admin Panel
            </h2>
            <p className="mt-1 truncate text-sm text-slate-400 light:text-slate-600">
              {email ? `Signed in as ${email}` : "Real InPlayer data — no dummy numbers."}
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-600 transition hover:border-indigo-400/40 hover:text-indigo-300"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-2 rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-4 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
