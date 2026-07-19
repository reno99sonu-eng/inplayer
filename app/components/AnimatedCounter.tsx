"use client";

import { useEffect, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  format: (n: number) => string;
  duration?: number;
}

export default function AnimatedCounter({
  value,
  format,
  duration = 1000,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let frame: number;

    function step(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.floor(eased * value));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span>{format(display)}</span>;
}
