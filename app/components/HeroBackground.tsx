"use client";

export default function HeroBackground() {
  return (
    <>
      <div className="absolute inset-0 overflow-hidden">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#1d4ed8_0%,transparent_35%)] opacity-30" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#f97316_0%,transparent_30%)] opacity-20" />

        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

      </div>
    </>
  );
}