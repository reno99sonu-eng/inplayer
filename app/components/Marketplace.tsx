export default function Marketplace() {
    return (
      <section
        id="marketplace"
        className="relative overflow-hidden bg-[#0B1220] py-14 md:py-20"
      >
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-blue-600/20 blur-[100px]" />
        {/* Premium Background */}

<div className="pointer-events-none absolute inset-0 overflow-hidden">

<h1
  className="
    absolute
    left-1/2
    top-8
    -translate-x-1/2
    whitespace-nowrap
    text-[170px]
    font-black
    tracking-[-0.08em]
    text-white/[0.025]
    select-none
    animate-pulse
  "
>
  CREATOR ECONOMY
</h1>

<div
  className="
    absolute
    left-[-10%]
    top-0
    h-[520px]
    w-[520px]
    rounded-full
    bg-orange-500/10
    blur-[170px]
  "
/>

<div
  className="
    absolute
    right-[-10%]
    bottom-0
    h-[520px]
    w-[520px]
    rounded-full
    bg-cyan-500/10
    blur-[170px]
  "
/>

</div>
  
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
  
          {/* Heading */}
  
          <div className="mx-auto max-w-4xl text-center">

  <span
    className="
      inline-flex
      items-center
      rounded-full
      border
      border-cyan-400/20
      bg-gradient-to-r
      from-cyan-500/10
      to-blue-500/10
      px-5
      py-2
      text-[11px]
      font-bold
      uppercase
      tracking-[0.38em]
      text-cyan-300
      backdrop-blur-xl
    "
  >
    Creator Marketplace
  </span>

  <h2
    className="
      mt-7
      text-5xl
      md:text-6xl
      font-black
      leading-[0.9]
      tracking-[-0.05em]
      bg-gradient-to-b
      from-white
      via-slate-100
      to-slate-400
      bg-clip-text
      text-transparent
    "
  >
    One Platform.
    <br />
    Infinite Partnerships.
  </h2>

  <p
    className="
      mx-auto
      mt-7
      max-w-3xl
      text-lg
      leading-8
      text-slate-300
    "
  >
    Connect with verified brands, discover premium collaborations,
    negotiate securely, automate payments and grow your creator
    business through one intelligent marketplace.
  </p>

</div>
  
          {/* Cards */}
  
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  
            {[
  {
    icon: "⬢",
    badge: "VERIFIED",
    title: "Business Campaigns",
    desc: "Premium brands launch verified campaigns for the world's best creators.",
  },
  {
    icon: "{card.icon}",
    badge: "AI POWERED",
    title: "Intelligent Matching",
    desc: "Advanced AI connects creators and brands using audience intelligence.",
  },
  {
    icon: "◈",
    badge: "SECURE",
    title: "Creator Payments",
    desc: "Contracts, invoices and instant global payouts managed securely.",
  },
].map((card) => (
  
              <button
  key={card.title}
  className="
    group
    relative
    overflow-hidden
    rounded-[28px]
    border
    border-white/10
    bg-gradient-to-br
    from-[#111A2B]/95
    via-[#182235]/95
    to-[#0A1220]/95
    p-5
    text-left
    backdrop-blur-3xl
    transition-all
    duration-500
    hover:-translate-y-3
    hover:border-orange-400/40
    hover:shadow-[0_30px_70px_rgba(249,115,22,.18)]
  "
>

  {/* Glass Reflection */}

  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.06),transparent_45%)]" />

  {/* Hover Glow */}

  <div
    className="
      absolute
      -bottom-16
      left-1/2
      h-40
      w-40
      -translate-x-1/2
      rounded-full
      bg-orange-500/10
      blur-[70px]
      opacity-0
      transition-all
      duration-500
      group-hover:opacity-100
    "
  />

  <div className="relative z-10">

    <div className="flex items-center justify-between">

      <div
        className="
        relative
        flex
        h-14
        w-14
        items-center
        justify-center
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-gradient-to-br
        from-[#22314C]
        via-[#18263B]
        to-[#0A1220]
        shadow-[0_10px_35px_rgba(0,0,0,.35)]
        transition-all
        duration-500
        group-hover:scale-110
        group-hover:-translate-y-1
        group-hover:rotate-6
      "
      >

  {/* Glass Reflection */}

  <div
    className="
      pointer-events-none
      absolute
      inset-0
      rounded-2xl
      bg-[linear-gradient(135deg,rgba(255,255,255,.12),transparent_45%)]
    "
  />

  {/* Moving Shine */}

  <div
    className="
      pointer-events-none
      absolute
      -left-8
      top-0
      h-full
      w-5
      rotate-12
      bg-white/20
      blur-md
      opacity-0
      transition-all
      duration-700
      group-hover:left-16
      group-hover:opacity-100
    "
  />

        {card.title === "Business Campaigns" && (
  <svg
    className="h-7 w-7 text-cyan-300 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 20h16" />
    <path d="M6 20V8l6-4 6 4v12" />
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
    <path d="M9 16h.01" />
    <path d="M15 16h.01" />
  </svg>
)}

{card.title === "Intelligent Matching" && (
  <svg
    className="h-7 w-7 text-orange-300 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
  </svg>
)}

{card.title === "Creator Payments" && (
  <svg
    className="h-7 w-7 text-emerald-300 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18" />
    <path d="M16 15h2" />
  </svg>
)}
      </div>

      <span
        className="
          rounded-full
          border
          border-emerald-500/20
          bg-emerald-500/10
          px-2.5
          py-1
          text-[10px]
          font-semibold
          uppercase
          tracking-[0.25em]
          text-emerald-300
        "
      >
        {card.badge}
      </span>

    </div>

    <h3
      className="
        mt-5
        text-[22px]
        font-black
        tracking-[-0.03em]
        text-white
      "
    >
      {card.title}
    </h3>

    <p
      className="
        mt-3
        text-[14px]
        leading-7
        text-slate-400
      "
    >
      {card.desc}
    </p>

    <div
      className="
        mt-6
        inline-flex
        items-center
        gap-2
        text-sm
        font-semibold
        tracking-wide
        text-orange-300
        transition-all
        duration-300
        group-hover:translate-x-2
      "
    >
      Explore Platform

      <span className="transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>

    </div>

  </div>

</button>
  
            ))}
  
          </div>
  
        </div>
  
      </section>
    );
  }