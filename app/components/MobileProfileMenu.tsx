"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LogOut, MessageSquare, Settings, User } from "lucide-react";

import { useAuthModal } from "./auth/AuthProvider";

export default function MobileProfileMenu({
  isActive = false,
}: {
  // Passed by MobileBottomNav.tsx so the "You" tab glows the same way the
  // Home/Raftaar/In-Family tabs do when the current page belongs to the
  // signed-in user's own area (profile, settings, watchlist, etc.).
  isActive?: boolean;
}) {
  const router = useRouter();
  const { user, signedIn, openSignIn, signOut } = useAuthModal();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Downloads is intentionally not linked here — it's an app-only feature
  // (see app/downloads/page.tsx), not offered on the website.
  const items = [
    { label: "Your Channel", icon: User, href: "/my-videos" },
    { label: "My Profile", icon: User, href: "/profile" },
    { label: "Watchlist", icon: Heart, href: "/watchlist" },
    // Same rename as the desktop avatar menu (NavbarProfile.tsx) and the
    // Account screen — the route stays /messages on purpose.
    { label: "My MilonBook", icon: MessageSquare, href: "/messages" },
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  return (
    <div ref={rootRef} className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => {
          if (!signedIn) {
            openSignIn();
            return;
          }
          setOpen((current) => !current);
          // This menu's items use onClick + router.push rather than
          // <Link>, so Next never auto-prefetches them — warm all five
          // destinations the instant the menu opens instead of leaving
          // each one to cold-fetch on tap.
          for (const item of items) router.prefetch(item.href);
        }}
        aria-expanded={open}
        aria-label={signedIn ? "Open account menu" : "Sign in"}
        className={`flex flex-col items-center gap-1 px-3 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition-all duration-200 ${
          isActive
            ? "text-orange-400 font-black scale-105"
            : "text-slate-300 light:text-slate-600 hover:text-orange-300 light:hover:text-orange-600"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user avatars can be data URLs. */}
        <img
          src={user?.avatarUrl || "/avatars/avatar.png"}
          alt=""
          className={`h-[22px] w-[22px] rounded-full object-cover ring-1 ${
            isActive
              ? "ring-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.85)] filter"
              : "ring-orange-400/50"
          }`}
        />
        <span className={`text-[11px] ${isActive ? "font-black text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.7)]" : "font-medium"}`}>
          You
        </span>
      </button>

      {open && (
        <div className="fixed bottom-[74px] right-2 z-[110] w-[min(320px,calc(100vw-1rem))] overflow-hidden rounded-3xl border border-white/10 bg-[#08111F]/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,.5)] backdrop-blur-3xl light:border-black/10 light:bg-[#F5EEDC]/95">
          <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3 light:border-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- user avatars can be data URLs. */}
            <img src={user?.avatarUrl || "/avatars/avatar.png"} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="min-w-0"><p className="truncate text-sm font-black text-white light:text-slate-900">{user?.name}</p><p className="truncate text-xs text-slate-400 light:text-slate-600">{user?.email}</p></div>
          </div>
          <div className="pt-2">
            {items.map((item) => {
              const Icon = item.icon;
              return <button key={item.label} type="button" onClick={() => go(item.href)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-white transition hover:bg-white/10 light:text-slate-900 light:hover:bg-black/5"><Icon size={17} className="text-orange-400" />{item.label}</button>;
            })}
            <div className="my-2 border-t border-white/10 light:border-black/10" />
            <button type="button" onClick={async () => { setOpen(false); await signOut(); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-red-400 transition hover:bg-red-500/10"><LogOut size={17} />Sign Out</button>
          </div>
        </div>
      )}
    </div>
  );
}
