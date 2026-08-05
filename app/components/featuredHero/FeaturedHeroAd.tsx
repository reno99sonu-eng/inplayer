"use client";

interface FeaturedHeroAdCreative {
  adId: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
}

// Live counterpart to FeaturedHero.tsx's real-videos carousel — rendered
// in the exact same slot instead of it when Admin Panel -> Advertising ->
// Weekly Featured Banner is switched ON and has at least one active
// creative uploaded (see getHeroContent() in app/page.tsx). This is the
// actual "wiring up" of that placement: previously nothing on the live
// site ever read weeklyFeaturedEnabled or fetched a weekly_featured
// creative, so anything uploaded there was invisible to real visitors.
//
// Sized to the exact same box as FeaturedHero (same className) so
// swapping between the two never causes a layout jump, and — matching
// FeaturedHero's own black-screen fix — takes its creative as a
// server-fetched prop instead of doing its own client-side fetch, so
// there's no blank/loading flash on first paint here either. Only needs
// "use client" for the click-tracking handler below.
export default function FeaturedHeroAd({
  creative,
}: {
  creative: FeaturedHeroAdCreative;
}) {
  const handleClick = () => {
    // Fire-and-forget, same as AdBanner.tsx's other placements — never
    // delays or blocks the actual navigation.
    fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: creative.adId }),
    }).catch(() => {});
  };

  return (
    <section
      aria-label="Featured"
      className="
        relative w-full overflow-hidden bg-black

        min-h-[220px]
        sm:min-h-[250px]
        md:min-h-[280px]
        lg:h-[34vh]
        xl:h-[36vh]
        2xl:h-[38vh]
      "
    >
      <a
        href={creative.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="group relative block h-full w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded creative is a compressed data: URL, next/image can't optimize it (same reasoning as AdBanner.tsx) */}
        <img
          src={creative.imageUrl}
          alt={creative.title || "Featured"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <span className="absolute right-3 top-3 z-10 rounded-md bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-orange-400 border border-orange-500/30">
          Ad
        </span>

        {creative.title && (
          <div className="absolute left-4 bottom-4 z-10 max-w-[80%] rounded-lg bg-black/70 backdrop-blur-md px-3 py-1.5 text-sm font-bold text-white border border-white/10">
            {creative.title}
          </div>
        )}
      </a>
    </section>
  );
}
