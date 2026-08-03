"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { fetchAuthSession } from "aws-amplify/auth";
import NavbarLogo from "./NavbarLogo";
import NavbarLinks from "./NavbarLinks";
import { Menu, X, Search, Home, PlaySquare, ChevronRight, ChevronDown, LogOut, Mail, Copy, Check } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";
import NavbarSearch from "./NavbarSearch";
import NavbarActions from "./NavbarActions";
import NavbarProfile from "./NavbarProfile";
import MobileMenu from "./MobileMenu";
import NavigationCategories from "./NavigationCategories";
import MobileSearchOverlay from "./MobileSearchOverlay";
import { useRouter } from "next/navigation";
import { CONTACT_EMAILS } from "@/app/lib/contactEmails";



export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [subscribedChannels, setSubscribedChannels] = useState<
    {
      creatorId: string;
      username: string;
      name: string;
      avatarUrl: string | null;
      notifyEnabled: boolean;
    }[]
  >([]);

  const [showMoreChannels, setShowMoreChannels] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signedIn, user, signOut, openSignIn, openSignUp } = useAuthModal();
  const [navbarTheme, setNavbarTheme] = useState<{ active: boolean; imageUrl: string; occasionId?: string; title?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/navbar-theme");
        if (!res.ok) return;
        const data = await res.json().catch(() => ({ active: false }));
        if (!cancelled && data?.active && data?.theme?.imageUrl) {
          setNavbarTheme({
            active: true,
            imageUrl: data.theme.imageUrl,
            occasionId: data.theme.occasionId,
            title: data.theme.title,
          });
        }
      } catch (err) {
        console.error("Navbar theme fetch error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setSubscribedChannels([]);
      return;
    }
  
    async function loadSubscriptions() {
      try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
    
        if (!idToken) {
          return;
        }
    
        const res = await fetch("/api/subscriptions/list", {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
    
        if (!res.ok) {
          console.error(await res.text());
          return;
        }
    
        const data = await res.json();
        setSubscribedChannels(data.subscriptions ?? []);
      } catch (err) {
        console.error("Failed to load subscriptions:", err);
      }
    }
  
    loadSubscriptions();
  }, [signedIn]);

  const copyEmail = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedEmail(address);
      setTimeout(() => setCopiedEmail((cur) => (cur === address ? null : cur)), 1800);
    } catch {
      /* clipboard unavailable — the mailto: link on the row still works */
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const goTo = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  };

  return (
    <>
      <header
        className="
          relative
          sticky
          top-0
          z-50
          border-b
          border-white/5
          light:border-black/10
          bg-[#06101D]/90
          light:bg-[#F5EEDC]/95
          backdrop-blur-[28px]
          shadow-[0_12px_40px_rgba(0,0,0,.35)]
          light:shadow-[0_12px_40px_rgba(0,0,0,.08)]
        "
      >
      {/* Mobile / Tablet Background Branding */}
<div
  className="
    absolute
    inset-0
    lg:hidden
    pointer-events-none
    overflow-hidden
    flex
    items-center
    justify-center
  "
>
  <span
    className="
      select-none
      whitespace-nowrap
      font-black
      uppercase
      tracking-[0.35em]
      text-[54px]
      sm:text-[72px]
      text-white/[0.03]
      light:text-black/[0.03]
      blur-[1.5px]
    "
  >
    INPLAYER
  </span>
</div>
        <div className="mx-auto flex h-12 lg:h-16 max-w-[1700px] items-center px-3 lg:px-5">


        
          {/* Desktop / TV Hamburger */}
<div className="hidden lg:flex flex-shrink-0 mr-4">
  <button
    onClick={() => setMenuOpen(!menuOpen)}
    className="
      flex
      h-11
      w-11
      items-center
      justify-center
      rounded-2xl
      border
      border-white/10
      light:border-black/10
      bg-white/5
      light:bg-black/5
      backdrop-blur-xl
      transition-all
      duration-300
      hover:scale-105
      hover:border-orange-400/50
      hover:bg-orange-500/10
      hover:shadow-[0_0_25px_rgba(249,115,22,.25)]
    "
  >
    <div className="relative h-6 w-6">
      <Menu
        size={22}
        strokeWidth={2.2}
        className={`absolute transition-all duration-300 ${
          menuOpen
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100 text-white light:text-slate-900"
        }`}
      />
      <X
        size={22}
        strokeWidth={2.2}
        className={`absolute transition-all duration-300 ${
          menuOpen
            ? "rotate-0 scale-100 opacity-100 text-orange-300"
            : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </div>
  </button>
</div>

{/* Desktop Logo & Festive Occasion Graphic */}
<div className="hidden lg:flex flex-shrink-0 items-center">
  {/* Pure Clean Logo */}
  <NavbarLogo />

  {/* Pure Transparent Occasion Graphic with Animated Watermark Text strictly behind the graphic */}
  {navbarTheme?.active && navbarTheme.imageUrl && (
    <div className="relative ml-3 sm:ml-3.5 inline-flex items-center flex-shrink-0">
      {/* Animated Transparent Text Behind Festive Graphic */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden flex items-center justify-center scale-125">
        <span className="whitespace-nowrap truncate max-w-full text-[10px] lg:text-xs font-black uppercase tracking-widest bg-gradient-to-r from-orange-400 via-amber-200 to-pink-500 bg-clip-text text-transparent opacity-40 animate-pulse blur-[0.3px]">
          {(() => {
            const occId = navbarTheme.occasionId;
            if (occId === "independence_day") return "HAPPY INDEPENDENCE DAY";
            if (occId === "diwali") return "HAPPY DIWALI";
            if (occId === "holi") return "HAPPY HOLI";
            if (occId === "republic_day") return "HAPPY REPUBLIC DAY";
            if (occId === "new_year") return "HAPPY NEW YEAR 2026";
            if (occId === "cyberpunk") return "CYBERPUNK MODE";
            return navbarTheme.title ? navbarTheme.title.toUpperCase() : "HAPPY CELEBRATION";
          })()}
        </span>
      </div>

      {/* Festive Graphic Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={navbarTheme.imageUrl}
        alt="Occasion Graphic"
        className="relative z-10 h-10 lg:h-11 xl:h-12 w-auto object-contain drop-shadow-[0_2px_12px_rgba(255,165,0,0.4)]"
      />
    </div>
  )}
</div>

{/* Desktop Search */}
<div className="hidden lg:flex flex-1 justify-center px-10 min-w-0">
  <NavbarSearch />
</div>

{/* Mobile Row */}
<div className="lg:hidden flex items-center flex-1 min-w-0">

  {/* Hamburger */}
  <div className="flex-shrink-0">
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      className="
        flex
        h-9
        w-9
        items-center
        justify-center
        rounded-xl
        border
        border-white/10
        light:border-black/10
        bg-white/5
        light:bg-black/5
        backdrop-blur-xl
      "
    >
      <div className="relative h-5 w-5">
        <Menu
          size={18}
          className={`absolute transition-all duration-300 ${
            menuOpen
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100 text-white light:text-slate-900"
          }`}
        />
        <X
          size={18}
          className={`absolute transition-all duration-300 ${
            menuOpen
              ? "rotate-0 scale-100 opacity-100 text-orange-300"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>
    </button>
  </div>

  {/* Mobile / tablet logo + Festive Occasion Graphic */}
  <div className="flex-shrink-0 ml-2 flex items-center min-w-0">
    {/* Pure Clean Mobile Logo */}
    <NavbarLogo />

    {/* Pure Transparent Occasion Graphic with Animated Watermark Text strictly behind the graphic */}
    {navbarTheme?.active && navbarTheme.imageUrl && (
      <div className="relative ml-2 sm:ml-2.5 inline-flex items-center flex-shrink-0">
        {/* Animated Transparent Text Behind Mobile Festive Graphic */}
        <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden flex items-center justify-center scale-125">
          <span className="whitespace-nowrap truncate max-w-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-400 via-amber-200 to-pink-500 bg-clip-text text-transparent opacity-40 animate-pulse blur-[0.3px]">
            {(() => {
              const occId = navbarTheme.occasionId;
              if (occId === "independence_day") return "HAPPY INDEPENDENCE DAY";
              if (occId === "diwali") return "HAPPY DIWALI";
              if (occId === "holi") return "HAPPY HOLI";
              if (occId === "republic_day") return "HAPPY REPUBLIC DAY";
              if (occId === "new_year") return "HAPPY NEW YEAR 2026";
              if (occId === "cyberpunk") return "CYBERPUNK MODE";
              return navbarTheme.title ? navbarTheme.title.toUpperCase() : "HAPPY CELEBRATION";
            })()}
          </span>
        </div>

        {/* Festive Graphic Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={navbarTheme.imageUrl}
          alt="Occasion Graphic"
          className="relative z-10 h-7 sm:h-8 md:h-9 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,165,0,0.35)]"
        />
      </div>
    )}
  </div>

</div>

{/* Right Side */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">

{/* Desktop Notification (unchanged) */}
<div className="hidden lg:flex scale-[0.9] origin-right">
  <NavbarActions />
</div>

{/* Desktop Profile (unchanged) */}
<div className="hidden lg:flex scale-[0.82] origin-right">
  <NavbarProfile />
</div>

{/* Mobile Search + Notification (Create + Profile moved to bottom nav) */}
<div
  className={`lg:hidden items-center gap-1.5 ${
    mobileSearchOpen ? "hidden" : "flex"
  }`}
>
  {/* Search Icon — moved beside the notification bell */}
  <button
    onClick={() => setMobileSearchOpen(true)}
    aria-label="Search"
    className="
      flex
      h-9
      w-9
      flex-shrink-0
      items-center
      justify-center
      rounded-full
      border
      border-white/10
      light:border-black/10
      bg-white/5
      light:bg-black/5
      text-white
      light:text-slate-900
    "
  >
    <Search size={18} />
  </button>

  <div className="scale-[0.85] origin-right">
    <NavbarActions />
  </div>
</div>

            {/* <MobileMenu /> */}
          </div>
        </div>
      </header>
      <MobileSearchOverlay
  open={mobileSearchOpen}
  onClose={() => setMobileSearchOpen(false)}
/>
      <Suspense fallback={<div className="h-[48px] border-b border-white/5 light:border-black/10 bg-[#06101D]/95 light:bg-[#F5EEDC]/95" />}>
        <NavigationCategories />
      </Suspense>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/50 backdrop-blur-md transition-all duration-300 ${
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* YouTube-style Drawer */}
      <aside
        ref={menuRef}
        className={`
  fixed
  left-0
lg:left-0
lg:right-auto
  top-0
          z-[100]
          h-[100dvh]
          w-[340px]
          max-w-[88vw]
          border-l
          border-white/10
          light:border-black/10
          bg-[#07101F]/95
          light:bg-[#F5EEDC]/95
          backdrop-blur-3xl
          transition-transform
          duration-300
          ${
            menuOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 light:border-black/10 px-5 py-3">
            <button
              onClick={() => goTo("/")}
              aria-label="INPLAYER — Home"
              className="block rounded-2xl transition-transform duration-300 hover:scale-[1.02] active:scale-95"
            >
              {/* Same theme-matched pair NavbarLogo uses — the dark
                  wrapper/padding this used to need in light mode is gone
                  now that the light asset has its own proper dark tone. */}
              <img
                src="/logos/inplayer-mark-dark.png"
                alt="INPLAYER"
                draggable={false}
                className="light:hidden h-10 sm:h-11 w-auto object-contain"
              />
              <img
                src="/logos/inplayer-mark-light.png"
                alt="INPLAYER"
                draggable={false}
                className="hidden light:block h-10 sm:h-11 w-auto object-contain"
              />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            {/* Home / Shorts */}
            <div className="space-y-0.5">
              <button
                onClick={() => goTo("/")}
                className="
                  flex
                  w-full
                  items-center
                  gap-4
                  rounded-xl
                  px-3
                  py-2
                  text-left
                  text-slate-200
                  light:text-slate-700
                  transition-all
                  duration-300
                  hover:bg-white/5
                  light:hover:bg-black/5
                  hover:translate-x-1
                  hover:text-orange-300
                  light:hover:text-orange-600
                "
              >
                <Home size={19} />
                <span className="text-sm font-semibold">Home</span>
              </button>

              <button
                onClick={() => goTo("/shorts")}
                className="
                  flex
                  w-full
                  items-center
                  gap-4
                  rounded-xl
                  px-3
                  py-2
                  text-left
                  text-slate-200
                  light:text-slate-700
                  transition-all
                  duration-300
                  hover:bg-white/5
                  light:hover:bg-black/5
                  hover:translate-x-1
                  hover:text-orange-300
                  light:hover:text-orange-600
                "
              >
                <PlaySquare size={19} />
                <span className="text-sm font-semibold">Raftaar</span>
              </button>
            </div>

            {signedIn && (
              <>
                <div className="my-3 border-t border-white/10 light:border-black/10" />

            {/* You */}
            <div>
              <p className="mb-1 px-3 text-xs font-bold uppercase tracking-[0.25em] text-orange-300/80 light:text-orange-600/90">
                You
              </p>

              <div className="space-y-0.5">
                <button
                    onClick={() => goTo("/my-videos")}
                    className="
                      flex
                      w-full
                      items-center
                      rounded-xl
                      px-3
                      py-2
                      text-left
                      text-sm
                      text-slate-300
                      light:text-slate-700
                      transition-all
                      duration-300
                      hover:bg-white/5
                      light:hover:bg-black/5
                      hover:translate-x-1
                      hover:text-orange-300
                      light:hover:text-orange-600
                    "
                  >
                    Your Channel
                  </button>
                  <button
                    onClick={() => goTo("/playlists")}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-2
                      text-left
                      text-sm
                      text-slate-300
                      light:text-slate-700
                      transition-all
                      duration-300
                      hover:bg-white/5
                      light:hover:bg-black/5
                      hover:translate-x-1
                      hover:text-orange-300
                      light:hover:text-orange-600
                    "
                  >
                    Playlists
                  </button>
                  <button
                    onClick={() => goTo("/liked-videos")}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-2
                      text-left
                      text-sm
                      text-slate-300
                      light:text-slate-700
                      transition-all
                      duration-300
                      hover:bg-white/5
                      light:hover:bg-black/5
                      hover:translate-x-1
                      hover:text-orange-300
                      light:hover:text-orange-600
                    "
                  >
                    Liked Videos
                  </button>
                  <button
                    onClick={() => goTo("/history")}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-2
                      text-left
                      text-sm
                      text-slate-300
                      light:text-slate-700
                      transition-all
                      duration-300
                      hover:bg-white/5
                      light:hover:bg-black/5
                      hover:translate-x-1
                      hover:text-orange-300
                      light:hover:text-orange-600
                    "
                  >
                    History
                  </button>
                  <button
                    onClick={() => goTo("/shop")}
                    className="
                      flex
                      w-full
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-2
                      text-left
                      text-sm
                      text-slate-300
                      light:text-slate-700
                      transition-all
                      duration-300
                      hover:bg-white/5
                      light:hover:bg-black/5
                      hover:translate-x-1
                      hover:text-orange-300
                      light:hover:text-orange-600
                    "
                  >
                    HamMart
                  </button>
              </div>
            </div>

            <div className="my-3 border-t border-white/10 light:border-black/10" />

                {/* Subscriptions */}
                <div>
                  <button
                    onClick={() => goTo("/subscriptions")}
                    className="
                      mb-1
                      flex
                  w-full
                  items-center
                  justify-between
                  px-3
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.25em]
                  text-orange-300/80
                  light:text-orange-600/90
                  transition
                  hover:text-orange-300
                  light:hover:text-orange-600
                "
              >
                In-Family
                <ChevronRight size={14} />
              </button>

              <div className="space-y-0.5">
  {subscribedChannels.length === 0 ? (
    <div className="rounded-xl border border-white/10 light:border-black/10 bg-white/5 light:bg-black/5 px-3 py-4 text-center">
      <p className="text-sm font-medium text-slate-200 light:text-slate-700">
        You don't have any subscribed channels yet.
      </p>

      <p className="mt-1 text-xs text-slate-400 light:text-slate-500">
        Subscribe to your favourite creators and they'll appear here.
      </p>

      <button
        onClick={() => goTo("/creators")}
        className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-600"
      >
        Discover Creators
      </button>
    </div>
  ) : (
    subscribedChannels.map((channel) => (
      <button
  key={channel.creatorId}
  onClick={() => goTo(`/u/${channel.username}`)}
  className="
    flex
    w-full
    cursor-pointer
    items-center
    gap-3
    rounded-xl
    px-3
    py-1.5
    text-left
    transition-all
    duration-300
    hover:bg-white/5
    light:hover:bg-black/5
    hover:translate-x-1
  "
>
        <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full">
          <Image
            src={channel.avatarUrl || "/recommendations/avatars/default.jpg"}
            alt={channel.name}
            fill
            sizes="28px"
            className="object-cover"
          />
        </div>

        <span className="flex-1 truncate text-sm text-slate-200 light:text-slate-700">
          {channel.name}
        </span>

        {channel.notifyEnabled && (
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
        )}
      </button>
    ))
  )}
</div>
             </div>
              </>
            )}

            <div className="my-4 border-t border-white/10 light:border-black/10" />

            {signedIn ? (
              <div className="space-y-1">
                <p className="px-3 pb-1 text-xs text-slate-500">
                  Signed in as {user?.name}
                </p>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-2
                    text-left
                    text-sm
                    font-medium
                    text-red-400
                    transition-all
                    duration-300
                    hover:bg-red-500/10
                    hover:translate-x-1
                  "
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    openSignIn();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    rounded-xl
                    px-3
                    py-2
                    text-left
                    text-sm
                    text-slate-300
                    light:text-slate-700
                    transition-all
                    duration-300
                    hover:bg-white/5
                    light:hover:bg-black/5
                    hover:translate-x-1
                    hover:text-orange-300
                    light:hover:text-orange-600
                  "
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    openSignUp();
                  }}
                  className="
                    flex
                    w-full
                    items-center
                    rounded-xl
                    px-3
                    py-2
                    text-left
                    text-sm
                    text-slate-300
                    light:text-slate-700
                    transition-all
                    duration-300
                    hover:bg-white/5
                    light:hover:bg-black/5
                    hover:translate-x-1
                    hover:text-orange-300
                    light:hover:text-orange-600
                  "
                >
                  Create Account
                </button>
              </div>
            )}
            <div className="my-4 border-t border-white/10 light:border-black/10" />

            {/* Compact footer content — moved here from the page bottom */}
            <div className="px-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300 light:text-orange-600">
                  Company
                </h4>
                <ul className="mt-2 space-y-1.5">
                {["About", "Privacy", "Terms"].map(
                    (item) => (
                      <li key={item}>
                        <button className="text-xs text-slate-400 light:text-slate-600 transition hover:text-orange-300 light:hover:text-orange-600">
                          {item}
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>

            {/* Contact — where the Instagram/X icons used to sit. Toggles a
                panel of every @inplayer.in address inline, right here in
                the drawer (not a separate modal). */}
            <div className="mt-4 border-t border-white/10 light:border-black/10 px-3 pt-3">
              <button
                onClick={() => setContactOpen((v) => !v)}
                aria-expanded={contactOpen}
                className="
                  flex w-full items-center justify-between rounded-xl px-0 py-1
                  text-left transition
                  hover:text-orange-300 light:hover:text-orange-600
                "
              >
                <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300 light:text-orange-600">
                  <Mail size={12} />
                  Contact us
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-500 transition-transform duration-300 ${
                    contactOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-300 ${
                  contactOpen ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 space-y-1">
                  {CONTACT_EMAILS.map(({ address }) => (
                    <div
                      key={address}
                      className="
                        flex items-center justify-between gap-2 rounded-lg px-2 py-1.5
                        transition hover:bg-white/5 light:hover:bg-black/5
                      "
                    >
                      <a
                        href={`mailto:${address}`}
                        className="min-w-0 flex-1"
                        title={`Email ${address}`}
                      >
                        <span className="block truncate text-xs font-medium text-slate-200 light:text-slate-700">
                          {address}
                        </span>
                      </a>

                      <button
                        onClick={() => copyEmail(address)}
                        title="Copy address"
                        aria-label={`Copy ${address}`}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 light:hover:bg-black/10 hover:text-orange-300 light:hover:text-orange-600"
                      >
                        {copiedEmail === address ? (
                          <Check size={13} className="text-emerald-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 light:border-black/10 px-3 pt-3">
              <p className="text-[10px] text-slate-500">© 2026 Homox Prime Pvt Ltd</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
