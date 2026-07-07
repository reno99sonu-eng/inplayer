export default function Marketplace() {
    return (
      <section
        id="marketplace"
        className="relative overflow-hidden bg-[#0B1220] py-14 md:py-20"
      >
        <div className="absolute -left-20 top-20 h-64 w-64 rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-[100px]" />
  
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
  
          {/* Heading */}
  
          <div className="text-center">
  
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Creator Marketplace
            </span>
  
            <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black text-white">
              Brands.
              <br />
              Creators.
              <br />
              Connected.
            </h2>
  
            <p className="mx-auto mt-4 max-w-3xl text-base md:text-lg leading-7 text-slate-300">
              Discover campaigns, connect with businesses, negotiate partnerships
              and earn from your content in one intelligent marketplace.
            </p>
  
          </div>
  
          {/* Cards */}
  
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
  
            {[
              {
                icon: "🏪",
                title: "Business Campaigns",
                desc: "Verified businesses publish campaigns and hire creators.",
              },
              {
                icon: "🤖",
                title: "AI Matching",
                desc: "AI matches creators with brands using audience insights.",
              },
              {
                icon: "💰",
                title: "Secure Payments",
                desc: "Contracts, invoices and earnings managed in one place.",
              },
            ].map((card) => (
  
              <button
                key={card.title}
                className="group rounded-[24px] border border-white/10 bg-white/10 p-5 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400 hover:bg-white/15 hover:shadow-2xl"
              >
  
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl shadow-lg transition group-hover:scale-110">
  
                  {card.icon}
  
                </div>
  
                <h3 className="mt-5 text-xl font-bold text-white">
                  {card.title}
                </h3>
  
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {card.desc}
                </p>
  
                <div className="mt-5 font-semibold text-cyan-300 transition group-hover:translate-x-2">
                  Learn More →
                </div>
  
              </button>
  
            ))}
  
          </div>
  
        </div>
  
      </section>
    );
  }