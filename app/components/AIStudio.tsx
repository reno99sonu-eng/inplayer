"use client";

import { useState } from "react";
import {
  Sparkles,
  Wand2,
  Clapperboard,
  ImageIcon,
  Languages,
  TrendingUp,
  X,
} from "lucide-react";

export default function AIStudio() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Compact Section */}

      <section id="ai" className="bg-[#04070D] px-6 py-14">

        <div className="mx-auto max-w-5xl">

          <div className="overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,.45)]">

            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">

              <div>

                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-orange-300">

                  <Sparkles size={14} />

                  AI STUDIO

                </div>

                <h2 className="text-4xl font-black tracking-[-0.04em] text-white">
                  Create with AI
                </h2>

                <p className="mt-4 max-w-xl leading-8 text-slate-400">
                  Generate thumbnails, scripts, captions, translations,
                  voiceovers and publish-ready videos in seconds.
                </p>

              </div>

              <button
                onClick={() => setOpen(true)}
                className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 px-8 py-4 font-bold text-white transition hover:scale-105"
              >
                Launch AI Studio →
              </button>

            </div>

          </div>

        </div>

      </section>

      {/* Modal */}

      {open && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6 backdrop-blur-xl"
          onClick={() => setOpen(false)}
        >

          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-[34px] border border-white/10 bg-[#111827] p-7 shadow-[0_40px_100px_rgba(0,0,0,.6)]"
            onClick={(e) => e.stopPropagation()}
          >

            <button
              onClick={() => setOpen(false)}
              className="absolute right-6 top-6 rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20"
            >
              <X size={20} />
            </button>

            <div className="mb-8">

              <span className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                AI Studio
              </span>

              <h2 className="mt-3 text-4xl font-black text-white">
                Your Creative Co-Pilot
              </h2>

            </div>

            <div className="grid gap-6 lg:grid-cols-3">

              {/* Prompt */}

              <div className="rounded-3xl bg-white/5 p-6">

                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Prompt
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-slate-300">
                  Create a cinematic travel vlog with emotional music and AI captions.
                </div>

                <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 font-bold text-white">

                  <Wand2 size={18} />

                  Generate

                </button>

              </div>

              {/* Processing */}

              <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 p-6 text-white">

                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  AI Processing
                </p>

                <div className="mt-6 space-y-3">

                  {[
                    "✔ Script Generated",
                    "✔ Thumbnail Created",
                    "✔ Voiceover Ready",
                    "✔ Auto Captions Added",
                  ].map((item) => (

                    <div
                      key={item}
                      className="rounded-2xl bg-white/10 p-4 backdrop-blur"
                    >
                      {item}
                    </div>

                  ))}

                </div>

              </div>

              {/* Output */}

              <div className="rounded-3xl bg-white/5 p-6">

                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  Output
                </p>

                <div className="mt-6 space-y-4">

                  {[
                    [<Clapperboard size={20} />, "Video Ready", "4K Export Complete"],
                    [<ImageIcon size={20} />, "Thumbnail Ready", "AI Generated"],
                    [<Languages size={20} />, "12 Languages", "Translated"],
                    [<TrendingUp size={20} />, "SEO Score 98%", "Ready to Publish"],
                  ].map(([icon, title, sub], index) => (

                    <div
                      key={index}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                        {icon}
                      </div>

                      <div>

                        <h4 className="font-semibold text-white">
                          {title}
                        </h4>

                        <p className="text-sm text-slate-400">
                          {sub}
                        </p>

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            </div>

          </div>

        </div>

      )}
    </>
  );
}