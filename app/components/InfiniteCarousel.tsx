"use client";

import { ReactNode } from "react";

type InfiniteCarouselProps = {
  children: ReactNode;
};

export default function InfiniteCarousel({
  children,
}: InfiniteCarouselProps) {
  return (
    <div className="relative overflow-hidden">
      <div className="flex gap-5 overflow-x-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}