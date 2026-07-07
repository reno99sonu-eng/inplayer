export default function Features() {
    const features = [
      {
        title: "Video Platform",
        description: "Upload Shorts, Reels, Long Videos and Live Streams.",
        icon: "🎬",
      },
      {
        title: "AI Studio",
        description: "Generate scripts, thumbnails, captions and voiceovers.",
        icon: "🤖",
      },
      {
        title: "Creator Monetization",
        description: "Subscriptions, tips, memberships and ad revenue.",
        icon: "💰",
      },
      {
        title: "Marketplace",
        description: "Connect brands with creators for paid collaborations.",
        icon: "🛍️",
      },
      {
        title: "Business Profiles",
        description: "Verified businesses with campaigns and products.",
        icon: "🏢",
      },
      {
        title: "Analytics",
        description: "Real-time insights, audience growth and performance.",
        icon: "📈",
      },
    ];
  
    return (
      <section
        id="features"
        className="relative overflow-hidden py-14 md:py-20 bg-gradient-to-b from-white via-slate-50 to-white"
      >
        {/* Background */}
  
        <div className="absolute inset-0 pointer-events-none">
  
          <h1 className="hidden xl:block absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap text-[120px] font-black tracking-[-0.08em] text-slate-900/[0.03]">
            INPLAYER ECOSYSTEM
          </h1>
  
          <div className="absolute left-1/2 top-0 h-64 w-64 md:h-80 md:w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />
  
        </div>
  
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
  
          {/* Heading */}
  
          <div className="mx-auto max-w-3xl text-center">
  
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-700">
              Platform Features
            </span>
  
            <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900">
              Everything You Need
            </h2>
  
            <p className="mt-4 text-base md:text-lg leading-7 text-slate-600">
              AI, creators, businesses, commerce and monetization in one premium ecosystem.
            </p>
  
          </div>
  
          {/* Cards */}
  
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  
            {features.map((feature, index) => (
  
              <button
                key={feature.title}
                className="group rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400 hover:shadow-2xl"
              >
  
                <div className="flex items-center justify-between">
  
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-400 text-xl shadow-lg transition duration-300 group-hover:scale-110">
  
                    {feature.icon}
  
                  </div>
  
                  <span className="text-xs font-bold text-slate-300">
                    0{index + 1}
                  </span>
  
                </div>
  
                <h3 className="mt-5 text-xl font-bold text-slate-900">
                  {feature.title}
                </h3>
  
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {feature.description}
                </p>
  
                <div className="mt-5 font-semibold text-cyan-600 transition group-hover:translate-x-2">
                  Learn More →
                </div>
  
              </button>
  
            ))}
  
          </div>
  
        </div>
  
      </section>
    );
  }