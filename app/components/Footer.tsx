"use client";

import Image from "next/image";
import NavbarLogo from "./NavbarLogo";

const browse = [
  "Movies",
  "Series",
  "Originals",
  "Live TV",
  "Creators",
  "Podcasts",
];

const company = [
  "About",
  "Careers",
  "Partners",
  "Support",
  "Privacy",
  "Terms",
];

export default function Footer() {
  return (
    <footer className="relative mt-10 overflow-hidden border-t border-orange-500/10 bg-[#050816] text-white">

      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25px 25px,#f59e0b 2px,transparent 2px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-orange-500/10 blur-[120px] animate-pulse" />

      <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px] animate-pulse" />

      <div className="relative mx-auto max-w-[1600px] px-6 py-14 sm:px-8 lg:px-12">

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-5">

          <div className="xl:col-span-2">

            <div className="w-fit">
              <NavbarLogo />
            </div>

            <h3 className="mt-5 text-2xl font-black tracking-tight">
              Entertainment Beyond Limits
            </h3>

            <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
              The future of entertainment begins here. Discover blockbuster
              originals, premium creators, podcasts, live experiences and AI
              powered entertainment in one seamless destination.
            </p>

          </div>

          <div>

            <h4 className="text-sm font-bold uppercase tracking-[0.25em] text-orange-300">
              Browse
            </h4>

            <ul className="mt-5 space-y-3">
              {browse.map((i) => (
                <li key={i}>
                  <button className="text-slate-400 transition-all duration-300 hover:translate-x-1 hover:text-orange-300">
                    {i}
                  </button>
                </li>
              ))}
            </ul>

          </div>

          <div>

            <h4 className="text-sm font-bold uppercase tracking-[0.25em] text-orange-300">
              Company
            </h4>

            <ul className="mt-5 space-y-3">
              {company.map((i) => (
                <li key={i}>
                  <button className="text-slate-400 transition-all duration-300 hover:translate-x-1 hover:text-orange-300">
                    {i}
                  </button>
                </li>
              ))}
            </ul>

          </div>

          <div>

            <h4 className="text-sm font-bold uppercase tracking-[0.25em] text-orange-300">
              Stay Updated
            </h4>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">

              <input
                type="email"
                placeholder="Email address"
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-4 py-3 text-sm outline-none focus:border-orange-400"
              />

              <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-3 font-semibold transition hover:-translate-y-0.5">
                Subscribe
              </button>

            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">

              <button className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:border-orange-400">
                Google Play
              </button>

              <button className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:border-orange-400">
                App Store
              </button>

            </div>

          </div>

        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-6 text-sm text-slate-500 md:flex-row">

          <p>© 2026 INPLAYER. All Rights Reserved.</p>

          <div className="flex gap-6">
            {["Instagram", "X"].map((s) => (
              <button
                key={s}
                className="transition hover:text-orange-300"
              >
                {s}
              </button>
            ))}
          </div>

        </div>

      </div>

    </footer>
  );
}