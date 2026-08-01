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
          px-4
          pb-6
          sm:px-6
          sm:pb-7

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
          px-8
          lg:px-10
          mx-auto

          lg:flex
        "
      >
        <div className="max-w-[680px]">
          {children}
        </div>
      </div>
    </>
  );
}