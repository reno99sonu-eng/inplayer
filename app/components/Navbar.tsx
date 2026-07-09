"use client";

import NavbarLogo from "./NavbarLogo";
import NavbarLinks from "./NavbarLinks";
import NavbarSearch from "./NavbarSearch";
import NavbarActions from "./NavbarActions";
import NavbarProfile from "./NavbarProfile";
import MobileMenu from "./MobileMenu";

export default function Navbar() {
  return (
    <header
      className="
        sticky
        top-0
        z-50
        border-b
        border-white/20
        bg-white/80
        backdrop-blur-2xl
        shadow-lg
      "
    >
      <div className="mx-auto flex h-20 max-w-[1700px] items-center px-5">

        {/* Logo */}

        <div className="flex-shrink-0">
          <NavbarLogo />
        </div>

        {/* Navigation */}

        <div className="hidden xl:flex ml-8 flex-shrink-0">
          <NavbarLinks />
        </div>

        {/* Search */}

        <div className="hidden lg:flex flex-1 justify-center px-6 min-w-0">
          <NavbarSearch />
        </div>

        {/* Right */}

        <div className="ml-auto flex flex-shrink-0 items-center gap-3">
          <NavbarActions />
          <NavbarProfile />
          <MobileMenu />
        </div>

      </div>
    </header>
  );
}