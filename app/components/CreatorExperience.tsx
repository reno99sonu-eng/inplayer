export default function CreatorExperience() {
    return (
      <section
        id="creator"
        className="relative overflow-hidden bg-[#0F172A] py-14 md:py-20"
      >
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-[100px]" />
  
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
  
          {/* LEFT */}
  
          <div className="text-center lg:text-left">
  
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Creator Dashboard
            </span>
  
            <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-white">
              Everything You Need.
              <br />
              One Dashboard.
            </h2>
  
            <p className="mt-5 max-w-xl mx-auto lg:mx-0 text-base md:text-lg leading-7 text-slate-300">
              Upload videos, manage your audience, earn revenue, receive brand
              collaborations and use AI tools from one premium creator platform.
            </p>
  
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
  
              <button className="rounded-full bg-white px-8 py-4 font-semibold text-slate-900 transition hover:scale-105">
                Launch Dashboard
              </button>
  
              <button className="rounded-full border border-slate-600 px-8 py-4 font-semibold text-white transition hover:border-cyan-400">
                Explore
              </button>
  
            </div>
  
          </div>
  
          {/* RIGHT */}
  
          <div className="rounded-[28px] border border-white/10 bg-white/10 backdrop-blur-2xl p-5 md:p-6 shadow-[0_25px_60px_rgba(0,0,0,.35)]">
  
            <div className="flex items-center justify-between">
  
              <div>
  
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Live Dashboard
                </p>
  
                <h3 className="mt-2 text-2xl font-bold text-white">
                  Creator Overview
                </h3>
  
              </div>
  
              <span className="rounded-full bg-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
                ● Online
              </span>
  
            </div>
  
            {/* Stats */}
  
            <div className="grid grid-cols-2 gap-4 mt-6">
  
              <div className="rounded-2xl bg-white/10 p-4">
  
                <p className="text-xs text-slate-400">
                  Followers
                </p>
  
                <h4 className="mt-2 text-3xl font-black text-white">
                  1.2M
                </h4>
  
                <p className="mt-1 text-xs text-green-400">
                  ▲ +12.4%
                </p>
  
              </div>
  
              <div className="rounded-2xl bg-white/10 p-4">
  
                <p className="text-xs text-slate-400">
                  Revenue
                </p>
  
                <h4 className="mt-2 text-3xl font-black text-white">
                  ₹8.4L
                </h4>
  
                <p className="mt-1 text-xs text-cyan-300">
                  This Month
                </p>
  
              </div>
  
            </div>
  
            {/* Progress */}
  
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
  
              <div className="flex justify-between text-sm">
  
                <span className="text-white font-medium">
                  Upload Progress
                </span>
  
                <span className="text-cyan-300">
                  83%
                </span>
  
              </div>
  
              <div className="mt-3 h-2 rounded-full bg-white/10">
  
                <div className="h-2 w-4/5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"></div>
  
              </div>
  
            </div>
  
            {/* Quick Actions */}
  
            <div className="grid grid-cols-2 gap-3 mt-5">
  
              {[
                "AI Studio",
                "Upload",
                "Analytics",
                "Marketplace",
                "Brand Deals",
                "Community",
              ].map((tool) => (
  
                <button
                  key={tool}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white transition hover:bg-white/10"
                >
                  {tool}
                </button>
  
              ))}
  
            </div>
  
          </div>
  
        </div>
  
      </section>
    );
  }