export default function Hero() {
    return (
      <section
        id="hero"
        className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 pt-10 md:pt-16 lg:pt-20 pb-12 md:pb-16"
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
  
          {/* LEFT */}
  
          <div>
  
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-2 text-sm font-semibold text-blue-700 shadow-sm">
              🚀 India's Next Generation Creator Platform
            </span>
  
            <h1 className="mt-5 text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.92] tracking-[-0.05em]">
  
              <span className="block bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-transparent drop-shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
                Create.
              </span>
  
              <span className="block bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-transparent drop-shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
                Earn.
              </span>
  
              <span className="block bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-transparent drop-shadow-[0_8px_18px_rgba(15,23,42,0.10)]">
                Inspire.
              </span>
  
            </h1>
  
            <p className="mt-6 max-w-xl text-lg md:text-xl leading-8 text-slate-600">
              Build your audience, launch your business, collaborate with brands,
              create with AI and monetize everything from one premium creator ecosystem.
            </p>
  
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
  
              <button className="rounded-full bg-slate-900 px-8 py-4 font-semibold text-white shadow-xl transition duration-300 hover:-translate-y-1 hover:bg-black">
                Start Creating
              </button>
  
              <button className="rounded-full border border-slate-300 bg-white px-8 py-4 font-semibold text-slate-700 shadow-sm transition duration-300 hover:border-blue-500 hover:text-blue-600">
                Watch Demo
              </button>
  
            </div>
  
          </div>
  
          {/* RIGHT */}
  
          <div className="relative flex justify-center items-center">
  
            <div className="absolute h-[320px] w-[320px] rounded-full bg-blue-500/10 blur-[100px] md:h-[420px] md:w-[420px]" />
  
            <div className="relative w-full max-w-[620px] overflow-hidden rounded-[34px] border border-white/20 bg-gradient-to-br from-slate-950 via-[#162f86] to-indigo-900 shadow-[0_30px_70px_rgba(15,23,42,0.35)]">
  
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-[100px]" />
  
              <div className="relative p-6 md:p-8">
  
                <div className="flex items-start justify-between gap-4">
  
                  <div>
  
                    <p className="text-xs uppercase tracking-[0.35em] text-blue-300">
                      Creator OS
                    </p>
  
                    <h3 className="mt-2 text-3xl md:text-4xl font-black leading-tight text-white">
                      The Future of
                      <br />
                      Creator Economy
                    </h3>
  
                  </div>
  
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 whitespace-nowrap">
                    ● Live
                  </div>
  
                </div>
  
                <p className="mt-6 text-base leading-7 text-slate-300">
                  One intelligent platform connecting creators, AI, businesses,
                  commerce and monetization.
                </p>
  
                <div className="mt-6 grid grid-cols-3 gap-3">
  
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
  
                    <p className="text-2xl font-black text-white">
                      12+
                    </p>
  
                    <p className="mt-1 text-xs text-slate-300">
                      Creator Tools
                    </p>
  
                  </div>
  
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
  
                    <p className="text-2xl font-black text-white">
                      AI
                    </p>
  
                    <p className="mt-1 text-xs text-slate-300">
                      Studio
                    </p>
  
                  </div>
  
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
  
                    <p className="text-2xl font-black text-white">
                      ₹
                    </p>
  
                    <p className="mt-1 text-xs text-slate-300">
                      Monetize
                    </p>
  
                  </div>
  
                </div>
  
                <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
  
                  <div className="flex items-center justify-between">
  
                    <div>
  
                      <p className="text-xs uppercase tracking-[0.3em] text-blue-300">
                        Creator Dashboard
                      </p>
  
                      <h4 className="mt-2 text-lg md:text-xl font-bold text-white">
                        Everything connected.
                      </h4>
  
                    </div>
  
                    <div className="rounded-full bg-blue-500 px-3 py-2 text-xs font-semibold text-white">
                      Online
                    </div>
  
                  </div>
  
                </div>
  
              </div>
  
            </div>
  
          </div>
  
        </div>
      </section>
    );
  }