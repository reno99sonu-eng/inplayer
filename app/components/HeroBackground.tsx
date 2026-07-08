"use client";

export default function HeroBackground() {
  return (
    <>
      {/* Main ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">

        <div
          className="
            absolute
            -top-32
            left-1/2
            h-[700px]
            w-[700px]
            -translate-x-1/2
            rounded-full
            bg-orange-400/10
            blur-[180px]
            animate-pulse
          "
        />

        <div
          className="
            absolute
            right-0
            top-20
            h-[500px]
            w-[500px]
            rounded-full
            bg-blue-500/10
            blur-[160px]
          "
        />

        <div
          className="
            absolute
            left-0
            bottom-0
            h-[450px]
            w-[450px]
            rounded-full
            bg-yellow-300/10
            blur-[160px]
          "
        />

      </div>

      {/* Soft grid overlay */}

      <div
        className="
          absolute
          inset-0
          opacity-[0.03]
          pointer-events-none
        "
        style={{
          backgroundImage:
            "linear-gradient(to right,#000 1px,transparent 1px),linear-gradient(to bottom,#000 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </>
  );
}