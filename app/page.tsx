import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ContinueWatching from "./components/ContinueWatching";
import TrendingNow from "./components/TrendingNow";
import FloatingAIButton from "./components/FloatingAIButton";
import Footer from "./components/Footer";
import FeaturedHero from "./components/featuredHero/FeaturedHero";
import RecommendationFeed from "./components/RecommendationFeed";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050816]">
      {/* Premium Background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#04060F] via-[#091224] to-[#04060F]" />

        {/* Honeycomb Texture */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 24px 24px, rgba(255,176,59,0.18) 2px, transparent 2px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Orange Ambient Glow */}
        <div className="absolute -left-64 top-20 h-[600px] w-[600px] rounded-full bg-orange-500/10 blur-[180px]" />

        {/* Blue Ambient Glow */}
        <div className="absolute -right-64 bottom-0 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[180px]" />
      </div>

      <div className="relative z-10">
        <Navbar />

        <div className="space-y-10 lg:space-y-14">
        <FeaturedHero />

<div className="mx-auto h-px w-[92%] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

<TrendingNow />

<div className="mx-auto h-px w-[92%] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

<RecommendationFeed />

        {/* <ContinueWatching /> */}
        </div>

        <Footer />
      </div>

      <FloatingAIButton />
    </main>
  );
}