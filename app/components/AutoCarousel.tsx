"use client";

import {
    ReactNode,
    useEffect,
    useRef,
    useState,
  } from "react";

type AutoCarouselProps = {
  children: ReactNode;
};

export default function AutoCarousel({
  children,
}: AutoCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const resumeTimer = useRef<NodeJS.Timeout | null>(null);
  const pauseTemporarily = () => {
    setPaused(true);
  
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
    }
  
    resumeTimer.current = setTimeout(() => {
      setPaused(false);
    }, 2500);
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const timer = setInterval(() => {
        if (paused) return;
        const reachedEnd =
          container.scrollLeft + container.clientWidth >=
          container.scrollWidth - 10;
      
          if (reachedEnd) {
            container.scrollTo({
              left: 0,
              behavior: "smooth",
            });
          } else {
            const firstCard = container.firstElementChild as HTMLElement | null;

            if (!firstCard) return;
            
            container.scrollBy({
              left: firstCard.offsetWidth + 20,
              behavior: "smooth",
            });
        }
      }, 3500);

    return () => clearInterval(timer);
}, [paused]);

  return (
    <div
  ref={containerRef}
  onScroll={pauseTemporarily}
  onMouseEnter={() => setPaused(true)}
  onMouseLeave={() => {
    setTimeout(() => {
      setPaused(false);
    }, 1500);
  }}
  onTouchStart={() => setPaused(true)}
  onTouchEnd={() => {
    setTimeout(() => {
      setPaused(false);
    }, 2500);
  }}
      className="
        flex
        gap-5
        overflow-x-auto
        scrollbar-hide
        snap-x
        snap-mandatory
        pb-2
        scroll-smooth
      "
    >
      {children}
    </div>
  );
}