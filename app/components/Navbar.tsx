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
        border-white/30
        bg-white/75
        backdrop-blur-2xl
        shadow-[0_8px_30px_rgba(0,0,0,0.06)]
      "
    >
      <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-4 md:px-8">

        {/* Left */}

        <div className="flex items-center gap-10">

          <NavbarLogo />

          <NavbarLinks />

        </div>

        {/* Center */}

        <div className="hidden flex-1 justify-center px-8 lg:flex">

          <NavbarSearch />

        </div>

        {/* Right */}

        <div className="flex items-center gap-4">

          <NavbarActions />

          <NavbarProfile />

          <MobileMenu />

        </div>

      </div>

    </header>
  );
}