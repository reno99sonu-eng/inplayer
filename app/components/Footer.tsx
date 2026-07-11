"use client";

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
    <footer className="relative mt-6 overflow-hidden border-t border-orange-500/10 bg-[#050816] text-white">

      {/* Background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25px 25px,#f59e0b 2px,transparent 2px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="absolute -left-32 top-0 h-72 w-72 rounded-full bg-orange-500/10 blur-[110px]" />
      <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-[110px]" />

      <div className="relative mx-auto max-w-[1600px] px-4 py-3 lg:px-10 lg:py-5">

  <div className="grid grid-cols-2 gap-x-5 gap-y-4 xl:grid-cols-4 xl:gap-6">

          {/* Brand */}
          <div className="col-span-2">

          <div className="w-16 lg:w-fit">
              <NavbarLogo />
            </div>

            <h3 className="mt-2 text-lg font-black lg:text-xl">
              Entertainment Beyond Limits
            </h3>

            <p className="mt-2 max-w-xs text-xs leading-5 text-slate-400 lg:max-w-sm lg:text-sm lg:leading-6">
              Discover blockbuster originals, premium creators, live channels,
              podcasts and AI-powered entertainment in one destination.
            </p>

          </div>

          {/* Browse */}
          <div>

            <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
              Browse
            </h4>

            <ul className="mt-2 space-y-1.5">
              {browse.map((item) => (
                <li key={item}>
                  <button className="text-slate-400 transition hover:text-orange-300 hover:translate-x-1">
                    {item}
                  </button>
                </li>
              ))}
            </ul>

          </div>

          {/* Company */}
          <div>

            <h4 className="text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
              Company
            </h4>

            <ul className="mt-3 space-y-2">
              {company.map((item) => (
                <li key={item}>
                  <button className="text-slate-400 transition hover:text-orange-300 hover:translate-x-1">
                    {item}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center gap-4">

              <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
                <img
                  src="/icons/google-play.svg"
                  alt="Google Play"
                  className="h-6 w-6 brightness-0 invert lg:h-7 lg:w-7"
                />
              </button>

              <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
                <img
                  src="/icons/app-store.svg"
                  alt="App Store"
                  className="h-6 w-6 brightness-0 invert lg:h-7 lg:w-7"
                />
              </button>

            </div>

          </div>

        </div>

        {/* Bottom */}

        <div className="mt-4 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px] text-slate-500 md:flex-row">

          <p>© 2026 INPLAYER. All Rights Reserved.</p>

          <div className="flex items-center gap-5">

            <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
              <img
                src="/icons/instagram.svg"
                alt="Instagram"
                className="h-4 w-4 brightness-0 invert lg:h-5 lg:w-5"
              />
            </button>

            <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
              <img
                src="/icons/x.svg"
                alt="X"
                className="h-4 w-4 brightness-0 invert lg:h-5 lg:w-5"
              />
            </button>

          </div>

        </div>

      </div>

    </footer>
  );
}