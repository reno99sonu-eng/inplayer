"use client";

import { useEffect, useRef, useState } from "react";

import NavbarLogo from "./NavbarLogo";
import NavbarLinks from "./NavbarLinks";
import { Menu, X } from "lucide-react";
import NavbarSearch from "./NavbarSearch";
import NavbarActions from "./NavbarActions";
import NavbarProfile from "./NavbarProfile";
import MobileMenu from "./MobileMenu";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <header
        className="
          sticky
          top-0
          z-50
          border-b
          border-white/5
          bg-[#06101D]/70
          backdrop-blur-[28px]
          shadow-[0_12px_40px_rgba(0,0,0,.35)]
        "
      >
        <div className="mx-auto flex h-20 max-w-[1700px] items-center px-5">
          {/* Logo */}
          <div className="flex-shrink-0">
            <NavbarLogo />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden xl:flex ml-8 flex-shrink-0">
            <NavbarLinks />
          </div>

          {/* Desktop Search */}
          <div className="hidden lg:flex flex-1 justify-center px-10 min-w-0">
            <NavbarSearch />
          </div>

          {/* Mobile / Tablet Search */}
          <div className="lg:hidden flex flex-1 min-w-0 px-2 sm:px-3">
  <div className="flex w-[130px] sm:w-[165px] md:w-[200px]">
    <NavbarSearch />
  </div>
</div>

          {/* Right Side */}
          <div className="ml-auto mr-8 flex items-center gap-4">
            <NavbarActions />
            <NavbarProfile />

            {/* Premium Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="
                ml-2
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-2xl
                border
                border-white/10
                bg-white/5
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
                      : "rotate-0 scale-100 opacity-100 text-white"
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

            {/* <MobileMenu /> */}
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] bg-black/50 backdrop-blur-md transition-all duration-300 ${
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Premium Drawer */}
      <aside
        ref={menuRef}
        className={`
          fixed
          right-0
          top-0
          z-[100]
          h-screen
          w-[380px]
          max-w-[92vw]
          border-l
          border-white/10
          bg-[#07101F]/90
          backdrop-blur-3xl
          transition-transform
          duration-300
          ${menuOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-7">
            <h2 className="text-2xl font-black text-white">INPLAYER</h2>
            <p className="mt-2 text-sm text-slate-400">
              Entertainment Beyond Limits
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <button className="mb-8 w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 py-3 font-bold text-white transition hover:scale-[1.02]">
              ✦ Premium
            </button>

            <div className="space-y-2">
              {[
                "Movies",
                "TV Shows",
                "Shorts",
                "Live",
                "Creators",
                "Gaming",
                "Music",
              ].map((item) => (
                <button
                  key={item}
                  className="
                    flex
                    w-full
                    items-center
                    rounded-xl
                    px-4
                    py-3
                    text-left
                    text-slate-300
                    transition-all
                    duration-300
                    hover:bg-white/5
                    hover:translate-x-1
                    hover:text-orange-300
                  "
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="my-8 border-t border-white/10" />

            <div className="space-y-2">
              {["Settings", "Sign In", "Create Account"].map((item) => (
                <button
                  key={item}
                  className="
                    flex
                    w-full
                    items-center
                    rounded-xl
                    px-4
                    py-3
                    text-left
                    text-slate-300
                    transition-all
                    duration-300
                    hover:bg-white/5
                    hover:translate-x-1
                    hover:text-orange-300
                  "
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
