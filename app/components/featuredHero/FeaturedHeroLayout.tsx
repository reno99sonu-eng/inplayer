"use client";

import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function FeaturedHeroLayout({ children }: Props) {
  return (
    <>
      {/* Mobile — absolute inset-0 forces flex items-end to position content at the bottom left */}
      <div
        className="
          absolute
          inset-0
          z-20
          flex
          items-end
          px-3
          pb-3
          sm:px-6
          sm:pb-4

          lg:hidden
        "
      >
        <div className="w-full max-w-full">
          {children}
        </div>
      </div>

      {/* Desktop / TV — absolute inset-0 forces flex items-end to position content at the bottom left */}
      <div
        className="
          absolute
          inset-0
          z-20
          hidden
          items-end
          px-8
          pb-6
          lg:px-12
          lg:pb-8
          mx-auto
          max-w-[1800px]

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