"use client";

import { useState } from "react";
import { Mail, ChevronDown, Copy, Check } from "lucide-react";
import NavbarLogo from "./NavbarLogo";
import { CONTACT_EMAILS } from "@/app/lib/contactEmails";

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
  "Support",
  "Privacy",
  "Terms",
];

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const copyEmail = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedEmail(address);
      setTimeout(() => setCopiedEmail((cur) => (cur === address ? null : cur)), 1800);
    } catch {
      /* clipboard unavailable — the mailto: link on the row still works */
    }
  };

  return (
    <footer className="relative mt-2 overflow-hidden border-t border-orange-500/10 bg-[#050816] text-white lg:mt-6 light:border-orange-500/20 light:bg-[#FAF5E9] light:text-slate-900">

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

      <div className="relative mx-auto max-w-[1600px] px-4 py-2 lg:px-10 lg:py-5">

  <div className="grid grid-cols-2 gap-x-5 gap-y-2 lg:gap-y-4 xl:grid-cols-4 xl:gap-6">

          {/* Brand */}
          <div className="col-span-2">

          <div className="w-16 lg:w-fit">
              <NavbarLogo />
            </div>

            <h3 className="mt-1 text-sm font-black lg:mt-2 lg:text-xl light:text-slate-900">
              Entertainment Beyond Limits
            </h3>

            <p className="hidden max-w-sm text-sm leading-6 text-slate-400 lg:mt-2 lg:block light:text-slate-600">
              Discover blockbuster originals, premium creators, live channels,
              podcasts and AI-powered entertainment in one destination.
            </p>

          </div>

          {/* Browse */}
          <div>

            <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300 lg:text-xs light:text-orange-600">
              Browse
            </h4>

            <ul className="mt-1.5 space-y-1 lg:mt-2 lg:space-y-1.5">
              {browse.map((item) => (
                <li key={item}>
                  <button className="text-xs text-slate-400 transition hover:text-orange-300 hover:translate-x-1 lg:text-base light:text-slate-600 light:hover:text-orange-600">
                    {item}
                  </button>
                </li>
              ))}
            </ul>

          </div>

          {/* Company */}
          <div>

            <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300 lg:text-xs light:text-orange-600">
              Company
            </h4>

            <ul className="mt-1.5 space-y-1 lg:mt-3 lg:space-y-2">
              {company.map((item) => (
                <li key={item}>
                  <button className="text-xs text-slate-400 transition hover:text-orange-300 hover:translate-x-1 lg:text-base light:text-slate-600 light:hover:text-orange-600">
                    {item}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2 hidden items-center gap-4 lg:mt-3 lg:flex">

              <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
                <img
                  src="/icons/google-play.svg"
                  alt="Google Play"
                  className="h-6 w-6 brightness-0 invert lg:h-7 lg:w-7 light:invert-0 light:opacity-70"
                />
              </button>

              <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
                <img
                  src="/icons/app-store.svg"
                  alt="App Store"
                  className="h-6 w-6 brightness-0 invert lg:h-7 lg:w-7 light:invert-0 light:opacity-70"
                />
              </button>

            </div>

          </div>

        </div>

        {/* Contact Us — a clearly-visible button (not just a text link) that
            opens every @inplayer.in support address right here in the
            footer, each with one-tap copy. Same data/interaction as the
            Navbar mobile drawer's contact panel, via app/lib/contactEmails. */}
        <div className="mt-3 border-t border-white/10 pt-3 lg:mt-5 lg:pt-4 light:border-slate-200">
          <button
            type="button"
            onClick={() => setContactOpen((v) => !v)}
            aria-expanded={contactOpen}
            className="
              inline-flex items-center gap-2 rounded-full
              bg-gradient-to-r from-[#FF7A18] via-[#FF9A00] to-[#FFD54A]
              px-5 py-2.5 text-xs font-bold text-white
              shadow-[0_10px_25px_rgba(255,153,0,.25)]
              transition-all duration-300 hover:-translate-y-0.5
            "
          >
            <Mail size={14} />
            Contact Us
            <ChevronDown
              size={14}
              className={`transition-transform duration-300 ${
                contactOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <div
            className={`grid overflow-hidden transition-all duration-300 ${
              contactOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {CONTACT_EMAILS.map(({ address }) => (
                <div
                  key={address}
                  className="
                    flex items-center justify-between gap-2 rounded-lg px-2.5 py-2
                    transition hover:bg-white/5 light:hover:bg-black/5
                  "
                >
                  <a
                    href={`mailto:${address}`}
                    className="min-w-0 flex-1"
                    title={`Email ${address}`}
                  >
                    <span className="block truncate text-xs font-medium text-slate-200 light:text-slate-700">
                      {address}
                    </span>
                  </a>

                  <button
                    onClick={() => copyEmail(address)}
                    title="Copy address"
                    aria-label={`Copy ${address}`}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/10 light:hover:bg-black/10 hover:text-orange-300 light:hover:text-orange-600"
                  >
                    {copiedEmail === address ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom */}

        <div className="mt-2 flex flex-col items-center justify-between gap-1.5 border-t border-white/10 pt-2 text-[10px] text-slate-500 md:flex-row lg:mt-4 lg:text-[11px] light:border-slate-200 light:text-slate-600">

          <p>© 2026 Homox Prime Pvt Ltd</p>

          <div className="flex items-center gap-5">

            <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
              <img
                src="/icons/instagram.svg"
                alt="Instagram"
                className="h-4 w-4 brightness-0 invert lg:h-5 lg:w-5 light:invert-0 light:opacity-70"
              />
            </button>

            <button className="transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_12px_rgba(249,115,22,.8)]">
              <img
                src="/icons/x.svg"
                alt="X"
                className="h-4 w-4 brightness-0 invert lg:h-5 lg:w-5 light:invert-0 light:opacity-70"
              />
            </button>

          </div>

        </div>

      </div>

    </footer>
  );
}
