export default function AIStudio() {
    return (
      <section
        id="ai"
        className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] to-white py-14 md:py-20"
      >
        <div className="absolute left-1/2 top-10 h-64 w-64 md:h-80 md:w-80 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />
  
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
  
          {/* Heading */}
  
          <div className="text-center">
  
            <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
              AI Studio
            </span>
  
            <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900">
              Your Creative
              <br />
              Co-Pilot
            </h2>
  
            <p className="mx-auto mt-4 max-w-3xl text-base md:text-lg leading-7 text-slate-600">
              Create faster, edit smarter and grow your audience using intelligent
              tools designed specifically for creators.
            </p>
  
          </div>
  
          {/* Workspace */}
  
          <div className="mt-10 rounded-[28px] border border-slate-200 bg-white p-5 md:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
  
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
  
              {/* Prompt */}
  
              <div className="rounded-2xl bg-slate-50 p-5">
  
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">
                  Prompt
                </p>
  
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  Create a cinematic travel vlog with emotional music and AI captions.
                </div>
  
                <button className="mt-5 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-black">
                  Generate
                </button>
  
              </div>
  
              {/* Processing */}
  
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 p-5 text-white">
  
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  AI Processing
                </p>
  
                <div className="mt-5 space-y-3">
  
                  {[
                    "✔ Script Generated",
                    "✔ Thumbnail Created",
                    "✔ Voiceover Ready",
                    "✔ Auto Captions Added",
                  ].map((item) => (
  
                    <div
                      key={item}
                      className="rounded-xl bg-white/10 p-3 backdrop-blur"
                    >
                      {item}
                    </div>
  
                  ))}
  
                </div>
  
              </div>
  
              {/* Output */}
  
              <div className="rounded-2xl bg-slate-50 p-5">
  
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">
                  Output
                </p>
  
                <div className="mt-5 space-y-3">
  
                  {[
                    ["🎬", "Video Ready", "4K Export Complete"],
                    ["🖼️", "Thumbnail Ready", "AI Generated"],
                    ["🌍", "12 Languages", "Translated"],
                    ["📈", "SEO Score 98%", "Ready to Publish"],
                  ].map(([icon, title, sub]) => (
  
                    <div
                      key={title}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    >
  
                      <div className="flex items-center gap-3">
  
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-lg">
                          {icon}
                        </div>
  
                        <div>
  
                          <h4 className="font-semibold text-slate-900">
                            {title}
                          </h4>
  
                          <p className="text-xs text-slate-500">
                            {sub}
                          </p>
  
                        </div>
  
                      </div>
  
                    </div>
  
                  ))}
  
                </div>
  
              </div>
  
            </div>
  
          </div>
  
        </div>
  
      </section>
    );
  }