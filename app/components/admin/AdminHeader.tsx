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
          top-1
          select-none
          text-[56px]
          font-black
          tracking-[-0.08em]
          text-white/[0.025] light:text-black/[0.04]
          sm:top-2
          sm:text-[80px]
          lg:left-8
          lg:text-[140px]
        "
      >
        ADMIN
      </h1>

      {/* Below sm: two fixed rows (logo+controls, then identity) instead
          of relying on flex-wrap to reflow mid-content — that was the
          source of the cramped/broken mobile layout. From sm up, it's
          back to a single row like before. */}
      <div className="relative z-10 flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-6">
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
          <Link
            href="/admin/dashboard"
            aria-label="Admin Panel — Dashboard"
            className="flex-shrink-0 transition-transform duration-300 hover:scale-[1.03] active:scale-95"
          >
            <img
              src="/logos/inplayer-mark-dark.png"
              alt="INPLAYER"
              draggable={false}
              className="light:hidden h-7 w-auto object-contain sm:h-8"
            />
            <img
              src="/logos/inplayer-mark-light.png"
              alt="INPLAYER"
              draggable={false}
              className="hidden light:block h-7 w-auto object-contain sm:h-8"
            />
          </Link>

          {/* Theme + sign out ride the logo's row on mobile (always fits,
              two small controls), and move to the far right on sm+. */}
          <div className="flex flex-shrink-0 items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 text-slate-300 light:text-slate-600 transition hover:border-indigo-400/40 hover:text-indigo-300"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 rounded-full border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-500/10 sm:h-11 sm:w-11">
            <ShieldCheck size={18} className="text-indigo-300" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-xl font-black tracking-[-0.03em] text-white light:text-slate-900 sm:text-2xl lg:text-3xl">
              Admin Panel
            </h2>
            <p className="mt-1 truncate text-xs text-slate-400 light:text-slate-600 sm:text-sm">
              {email ? `Signed in as ${email}` : "Real InPlayer data — no dummy numbers."}
            </p>
          </div>
        </div>

        <div className="hidden flex-shrink-0 items-center gap-2 sm:flex">
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
