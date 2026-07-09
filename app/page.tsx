import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import Marketplace from "./components/Marketplace";
import DiscoverChannels from "./components/DiscoverChannels";
import PremiumBanner from "./components/PremiumBanner";
import ContinueWatching from "./components/ContinueWatching";
import FloatingAIButton from "./components/FloatingAIButton";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8FAFC]">

      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url('/images/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.04,
          zIndex: 0,
        }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 z-[1] bg-white/85" />

      <div className="relative z-10">

        <Navbar />

        <div className="space-y-6 lg:space-y-8">

          <Hero />

          <ContinueWatching />

          <Features />

          <Marketplace />

          <DiscoverChannels />

          <PremiumBanner />

        </div>

        <footer className="mt-8 border-t border-slate-200 bg-white/80 backdrop-blur-xl">

          <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">

            <div className="grid gap-8 md:grid-cols-4">

              <div>

                <img
                  src="/images/inplayer-logo.png"
                  alt="INPLAYER"
                  className="h-12 w-auto"
                />

                <p className="mt-4 text-sm leading-6 text-slate-600">
                  India's next-generation streaming platform for movies,
                  originals, creators, podcasts, live entertainment and AI.
                </p>

              </div>

              <div>

                <h3 className="font-bold text-slate-900">
                  Browse
                </h3>

                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>Movies</li>
                  <li>TV Shows</li>
                  <li>Shorts</li>
                  <li>Live TV</li>
                </ul>

              </div>

              <div>

                <h3 className="font-bold text-slate-900">
                  Company
                </h3>

                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li>About</li>
                  <li>Creators</li>
                  <li>Careers</li>
                  <li>Contact</li>
                </ul>

              </div>

              <div>

                <h3 className="font-bold text-slate-900">
                  Download
                </h3>

                <p className="mt-4 text-sm text-slate-600">
                  Android • iPhone • Smart TV • Tablet
                </p>

                <button className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white transition hover:bg-orange-600">
                  Download App
                </button>

              </div>

            </div>

            <div className="mt-8 border-t border-slate-200 pt-5 text-center text-sm text-slate-500">
              © 2026 INPLAYER. All Rights Reserved.
            </div>

          </div>

        </footer>

      </div>

      {/* Floating AI Button */}
      <FloatingAIButton />

    </main>
  );
}