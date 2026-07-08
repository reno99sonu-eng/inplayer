import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import CreatorExperience from "./components/CreatorExperience";
import AIStudio from "./components/AIStudio";
import Marketplace from "./components/Marketplace";
import TopCreators from "./components/TopCreators";
import PremiumBanner from "./components/PremiumBanner";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F8FAFC]">

      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/images/background.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.04,
          zIndex: 0,
        }}
      />

      {/* White Overlay */}
      <div className="absolute inset-0 bg-white/85 z-[1]" />

      <div className="relative z-10">

        <Navbar />

        <Hero />

        <Features />

        <CreatorExperience />

        <AIStudio />

        <Marketplace />

        <TopCreators />

        <PremiumBanner />

        <footer className="mt-12 border-t border-slate-200 bg-white/80 backdrop-blur-xl">

          <div className="mx-auto max-w-[1600px] px-4 md:px-8 py-12">

            <div className="grid gap-10 md:grid-cols-4">

              <div>

                <img
                  src="/images/inplayer-logo.png"
                  alt="INPLAYER"
                  className="h-14 w-auto"
                />

                <p className="mt-5 text-slate-600 leading-7">
                  India's next-generation streaming platform for movies,
                  originals, creators, podcasts, live entertainment and AI.
                </p>

              </div>

              <div>

                <h3 className="font-bold text-slate-900">
                  Browse
                </h3>

                <ul className="mt-5 space-y-3 text-slate-600">
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

                <ul className="mt-5 space-y-3 text-slate-600">
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

                <p className="mt-5 text-slate-600">
                  Android • iPhone • Smart TV • Tablet
                </p>

                <button className="mt-6 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white hover:bg-orange-600 transition">
                  Download App
                </button>

              </div>

            </div>

            <div className="mt-10 border-t border-slate-200 pt-6 text-center text-slate-500">
              © 2026 INPLAYER. All Rights Reserved.
            </div>

          </div>

        </footer>

      </div>

    </main>
  );
}