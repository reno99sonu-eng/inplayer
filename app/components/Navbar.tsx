"use client";

import { useState } from "react";

const menu = [
  { name: "Discover", id: "hero" },
  { name: "Creators", id: "creator" },
  { name: "AI Studio", id: "ai" },
  { name: "Marketplace", id: "marketplace" },
  { name: "Business", id: "features" },
  { name: "Pricing", id: "pricing" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <header className="sticky top-0 z-50 py-3 md:py-5">
      <div className="mx-auto max-w-[1450px] px-4 md:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/70 bg-white/75 backdrop-blur-3xl shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between px-5 md:px-8 py-4">

            {/* Logo */}

            <button
              onClick={() => scrollToSection("hero")}
              className="flex items-center gap-4"
            >
              <img
                src="/images/inplayer-logo.png"
                alt="INPLAYER Logo"
               className="h-14 w-14 md:h-16 md:w-16 rounded-2xl object-cover"
              />

              <div className="text-left">
                <h1 className="text-xl md:text-[25px] font-black tracking-[-0.05em] text-slate-900">
                  INPLAYER
                </h1>

                <p className="hidden sm:block text-[11px] uppercase tracking-[0.35em] text-slate-500">
                  Creator Economy
                </p>
              </div>
            </button>

            {/* Desktop Navigation */}

            <nav className="hidden xl:flex items-center gap-10">
              {menu.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="group relative text-[15px] font-semibold text-slate-600 transition hover:text-slate-900"
                >
                  {item.name}

                  <span className="absolute left-1/2 -bottom-3 h-[3px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-400 transition-all duration-300 group-hover:w-full" />
                </button>
              ))}
            </nav>

            {/* Desktop Buttons */}

            <div className="hidden xl:flex items-center gap-3">
              <button className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-600">
                Sign Up
              </button>

              <button className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-black">
                Login
              </button>
            </div>

            {/* Mobile Menu Button */}

            <button
              onClick={() => setOpen(!open)}
              className="xl:hidden flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:bg-slate-50"
            >
              <span
                className={`text-3xl leading-none transition-transform duration-300 ${
                  open ? "rotate-90" : ""
                }`}
              >
                {open ? "✕" : "☰"}
              </span>
            </button>
          </div>

          {/* Mobile Menu */}

          <div
            className={`overflow-hidden transition-all duration-500 xl:hidden ${
              open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="border-t border-slate-200 px-5 pb-6">
              <div className="flex flex-col gap-5 py-5">
                {menu.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="rounded-xl px-3 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    {item.name}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button className="rounded-xl border border-slate-300 py-3 font-semibold transition hover:bg-slate-100">
                  Sign Up
                </button>

                <button className="rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-black">
                  Login
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}