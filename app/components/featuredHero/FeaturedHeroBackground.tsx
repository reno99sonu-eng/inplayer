"use client";

export default function FeaturedHeroBackground() {
  return (
    <>
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/45" />

      {/* Left Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/65 to-transparent" />

      {/* Bottom Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-transparent to-transparent" />

      {/* Orange Glow */}
      <div className="absolute left-[-15%] top-[20%] h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[170px]" />

      {/* Blue Glow */}
      <div className="absolute right-[-15%] bottom-[-15%] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[170px]" />
    </>
  );
}