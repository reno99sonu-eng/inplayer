import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import CreatorExperience from "./components/CreatorExperience";
import AIStudio from "./components/AIStudio";
import Marketplace from "./components/Marketplace";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8FAFC]">

      <Navbar />

      <Hero />

      <Features />

      <CreatorExperience />

      <AIStudio />

      <Marketplace />

      <section
        id="pricing"
        className="bg-slate-900 py-20 text-center"
      >
        <h2 className="text-4xl md:text-5xl font-black text-white">
          Pricing Coming Soon
        </h2>

        <p className="mt-6 text-lg md:text-xl text-slate-300">
          Flexible plans for creators, businesses and brands.
        </p>
      </section>

    </main>
  );
}