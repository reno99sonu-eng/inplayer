"use client";

import {
  ArrowRight,
  Building2,
  ChartColumn,
  Clapperboard,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";

export default function Features() {
  const features = [
    {
      title: "Creator Studio",
      description:
        "Publish Shorts, Videos, Podcasts and Live Streams from one premium workspace.",
      icon: <Clapperboard size={24} />,
    },
    {
      title: "AI Production Suite",
      description:
        "Generate thumbnails, scripts, captions, translations and voiceovers using AI.",
      icon: <Sparkles size={24} />,
    },
    {
      title: "Revenue Hub",
      description:
        "Earn with memberships, subscriptions, tips, premium content and advertising.",
      icon: <Wallet size={24} />,
    },
    {
      title: "Creator Marketplace",
      description:
        "Discover brands, sponsorships and paid collaborations across industries.",
      icon: <Store size={24} />,
    },
    {
      title: "Verified Business Hub",
      description:
        "Build trusted business profiles with products, campaigns and partnerships.",
      icon: <Building2 size={24} />,
    },
    {
      title: "Performance Intelligence",
      description:
        "Track audience growth, engagement, watch time and revenue in real time.",
      icon: <ChartColumn size={24} />,
    },
  ];

  return (
    <section
      id="features"
      className="relative overflow-hidden bg-[#04070D] py-20"
    >
      {/* Background */}

      <div className="pointer-events-none absolute inset-0">

        <h1
          className="
            hidden
            xl:block
            absolute
            left-1/2
            top-0
            -translate-x-1/2
            whitespace-nowrap
            text-[170px]
            font-black
            tracking-[-0.08em]
            text-white/[0.025]
          "
        >
          CREATOR PLATFORM
        </h1>

        <div className="absolute -left-44 top-20 h-[520px] w-[520px] rounded-full bg-orange-500/10 blur-[180px]" />

        <div className="absolute -right-44 bottom-0 h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-[180px]" />

      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">

        {/* Heading */}

        <div className="mx-auto max-w-3xl text-center">

          <span
            className="
              inline-flex
              rounded-full
              border
              border-orange-500/20
              bg-orange-500/10
              px-4
              py-2
              text-xs
              font-bold
              uppercase
              tracking-[0.35em]
              text-orange-300
            "
          >
            Creator Platform
          </span>

          <h2 className="mt-6 text-4xl font-black tracking-[-0.03em] text-white lg:text-6xl">
            Everything You Need
          </h2>

          <p className="mt-5 text-lg leading-8 text-slate-400">
            Build, grow, monetize and manage your creator business inside one
            premium ecosystem.
          </p>

        </div>

        {/* Cards */}

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {features.map((feature, index) => (

            <button
              key={feature.title}
              className="
                group
                relative
                overflow-hidden
                rounded-[30px]
                border
                border-white/10
                bg-white/[0.04]
                p-7
                text-left
                backdrop-blur-xl
                shadow-[0_25px_70px_rgba(0,0,0,.45)]
                transition-all
                duration-500
                hover:-translate-y-3
                hover:border-orange-400/40
              "
            >

              {/* Glow */}

              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/10 blur-[90px] opacity-0 transition duration-500 group-hover:opacity-100" />

              <div className="flex items-center justify-between">

                <div
                  className="
                    flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-gradient-to-br
                    from-[#2563EB]
                    via-[#5B21B6]
                    to-[#F97316]
                    text-white
                    shadow-[0_12px_35px_rgba(37,99,235,.45)]
                    transition-all
                    duration-500
                    group-hover:scale-110
                    group-hover:rotate-6
                  "
                >
                  {feature.icon}
                </div>

                <span className="text-sm font-bold tracking-widest text-white/20">
                  0{index + 1}
                </span>

              </div>

              <h3 className="mt-6 text-2xl font-black tracking-[-0.03em] text-white">
                {feature.title}
              </h3>

              <p className="mt-4 text-[15px] leading-7 text-slate-400">
                {feature.description}
              </p>

              <div className="mt-7 flex items-center gap-2 font-semibold text-orange-300 transition duration-300 group-hover:translate-x-2">

                Explore Platform

                <ArrowRight size={18} />

              </div>

            </button>

          ))}

        </div>

      </div>

    </section>
  );
}