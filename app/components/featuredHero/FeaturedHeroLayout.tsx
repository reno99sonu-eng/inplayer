"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function FeaturedHeroLayout({ children }: Props) {
  return (
    <>
      {/* Mobile */}
      <div
        className="
          relative
          z-20
          flex
          h-full
          items-end
          px-6
          pb-10

          lg:hidden
        "
      >
        <div className="w-full max-w-full">
          {children}
        </div>
      </div>

      {/* Desktop / TV */}
      <div
        className="
          relative
          z-20
          hidden
          h-full
          max-w-[1800px]
          items-center
          px-12
          mx-auto

          lg:flex
        "
      >
        <div className="max-w-[760px]">
          {children}
        </div>
      </div>
    </>
  );
}