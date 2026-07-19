"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Image from "next/image";

import NavbarLogo from "./NavbarLogo";
import NavbarLinks from "./NavbarLinks";
import { Menu, X, Search, Home, PlaySquare, ChevronRight, ChevronDown, LogOut } from "lucide-react";
import { useAuthModal } from "./auth/AuthProvider";
import NavbarSearch from "./NavbarSearch";
import NavbarActions from "./NavbarActions";
import NavbarProfile from "./NavbarProfile";
import MobileMenu from "./MobileMenu";
import NavigationCategories from "./NavigationCategories";
import MobileSearchOverlay from "./MobileSearchOverlay";
import { useRouter } from "next/navigation";

const subscribedChannels = [
  { name: "ArjunCreates", avatar: "/recommendations/avatars/1.jpg", hasNew: true },
  { name: "TechVerse", avatar: "/recommendations/avatars/2.jpg", hasNew: true },
  { name: "HomeHack", avatar: "/recommendations/avatars/10.jpg", hasNew: false },
  { name: "SketchVerse", avatar: "/recommendations/avatars/9.jpg", hasNew: true },
  { name: "CodeCanvas", avatar: "/recommendations/avatars/16.jpg", hasNew: false },
  { name: "Wild Miles", avatar: "/recommendations/avatars/12.jpg", hasNew: false },
  { name: "Chef Armaan", avatar: "/recommendations/avatars/17.jpg", hasNew: true },
];

const moreChannels = [
  { name: "Fit Theory", avatar: "/recommendations/avatars/19.jpg", hasNew: false },
  { name: "Hidden Earth", avatar: "/recommendations/avatars/23.jpg", hasNew: false },
  { name: "Ocean Trails", avatar: "/recommendations/avatars/25.jpg", hasNew: true },
];

const youItems = [
  { label: "Your Channel", href: "/my-videos" },
  { label: "History", href: "/history" },
  { label: "Watchlist", href: "/watchlist" },
  { label: "Downloads", href: "/downloads" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMoreChannels, setShowMoreChannels] = useState(false);
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signedIn, user, signOut, openSignIn, openSignUp } = useAuthModal();

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
          light:border-black/5
          bg-[#06101D]/70
          light:bg-white/80
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
        <div className="mx-auto flex h-20 max-w-[1700px] items-center px-5">


        
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

{/* Desktop Logo Only */}
<div className="hidden lg:flex flex-shrink-0">
  <NavbarLogo />
</div>

{/* Desktop Search */}
<div className="hidden lg:flex flex-1 justify-center px-10 min-w-0">
  <NavbarSearch />
</div>

{/* Mobile Row */}
<div className="lg:hidden flex items-center flex-1 min-w-0">

  {/* Hamburger */}
  <div className="mr-3 flex-shrink-0">
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
      "
    >
      <div className="relative h-6 w-6">
        <Menu
          size={22}
          className={`absolute transition-all duration-300 ${
            menuOpen
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100 text-white light:text-slate-900"
          }`}
        />
        <X
          size={22}
          className={`absolute transition-all duration-300 ${
            menuOpen
              ? "rotate-0 scale-100 opacity-100 text-orange-300"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>
    </button>
  </div>

  {/* Search Icon */}
  <button
    onClick={() => setMobileSearchOpen(true)}
    className="
      flex
      h-11
      w-11
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
    <Search size={22} />
  </button>

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

{/* Mobile Notification (Create + Profile moved to bottom nav) */}
<div
  className={`lg:hidden items-center gap-2 ${
    mobileSearchOpen ? "hidden" : "flex"
  }`}
>
  <div className="scale-[0.9]">
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
      <Suspense fallback={<div className="h-[68px] border-b border-white/5 light:border-black/5 bg-[#06101D]/95 light:bg-white/95" />}>
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
          light:bg-white/95
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
          <div className="border-b border-white/10 light:border-black/10 px-6 py-5">
            <h2 className="text-xl font-black text-white light:text-slate-900">INPLAYER</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            <button className="mb-3 w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 py-2.5 font-bold text-white transition hover:scale-[1.02]">
              ✦ Premium
            </button>

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
                <span className="text-sm font-semibold">Shorts</span>
              </button>
            </div>

            {signedIn && (
              <>
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
                Subscriptions
                <ChevronRight size={14} />
              </button>

              <div className="space-y-0.5">
                {subscribedChannels.map((channel) => (
                  <button
                    key={channel.name}
                    className="
                      flex
                      w-full
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
                        src={channel.avatar}
                        alt={channel.name}
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    </div>

                    <span className="flex-1 truncate text-sm text-slate-200 light:text-slate-700">
                      {channel.name}
                    </span>

                    {channel.hasNew && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
                    )}
                  </button>
                ))}

                {showMoreChannels &&
                  moreChannels.map((channel) => (
                    <button
                      key={channel.name}
                      className="
                        flex
                        w-full
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
                          src={channel.avatar}
                          alt={channel.name}
                          fill
                          sizes="28px"
                          className="object-cover"
                        />
                      </div>

                      <span className="flex-1 truncate text-sm text-slate-200 light:text-slate-700">
                        {channel.name}
                      </span>

                      {channel.hasNew && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
                      )}
                    </button>
                  ))}
              </div>

              <button
                onClick={() => setShowMoreChannels(!showMoreChannels)}
                className="
                  mt-0.5
                  flex
                  w-full
                  items-center
                  gap-4
                  rounded-xl
                  px-3
                  py-1.5
                  text-left
                  text-slate-400
                  light:text-slate-500
                  transition-all
                  duration-300
                  hover:bg-white/5
                  light:hover:bg-black/5
                  hover:text-orange-300
                  light:hover:text-orange-600
                "
              >
                <ChevronDown
                  size={17}
                  className={`transition-transform duration-300 ${
                    showMoreChannels ? "rotate-180" : ""
                  }`}
                />
                <span className="text-sm font-semibold">
                  {showMoreChannels ? "Show less" : "Show more"}
                </span>
              </button>
            </div>

            <div className="my-3 border-t border-white/10 light:border-black/10" />

            {/* You */}
            <div>
              <p className="mb-1 px-3 text-xs font-bold uppercase tracking-[0.25em] text-orange-300/80 light:text-orange-600/90">
                You
              </p>

              <div className="space-y-0.5">
                {youItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => goTo(item.href)}
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
                    {item.label}
                  </button>
                ))}
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
            <div className="grid grid-cols-2 gap-4 px-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300 light:text-orange-600">
                  Browse
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {["Movies", "Series", "Originals", "Live TV", "Creators", "Podcasts"].map(
                    (item) => (
                      <li key={item}>
                        <button className="text-xs text-slate-400 light:text-slate-500 transition hover:text-orange-300 light:hover:text-orange-600">
                          {item}
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300 light:text-orange-600">
                  Company
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {["About", "Careers", "Partners", "Support", "Privacy", "Terms"].map(
                    (item) => (
                      <li key={item}>
                        <button className="text-xs text-slate-400 light:text-slate-500 transition hover:text-orange-300 light:hover:text-orange-600">
                          {item}
                        </button>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/10 light:border-black/10 px-3 pt-3">
              <p className="text-[10px] text-slate-500">© 2026 INPLAYER</p>

              <div className="flex items-center gap-4">
                <button className="transition hover:scale-110">
                  <img
                    src="/icons/instagram.svg"
                    alt="Instagram"
                    className="h-4 w-4 brightness-0 invert light:invert-0 light:opacity-60"
                  />
                </button>
                <button className="transition hover:scale-110">
                  <img
                    src="/icons/x.svg"
                    alt="X"
                    className="h-4 w-4 brightness-0 invert light:invert-0 light:opacity-60"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
