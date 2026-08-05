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
//
// The foreground image uses object-contain, NOT object-cover. This box's
// own aspect ratio isn't fixed — it ranges from a short, nearly-square
// shape on mobile (min-h-[220px] at whatever width the phone is) up to a
// wide 38vh-tall strip on large desktops — so there's no single ratio an
// admin could upload at that would always fill it edge-to-edge without
// cropping. Ad creatives also bake their headline/CTA copy directly into
// the image pixels (see the poster specs tab and the AI-generate tool),
// so cropping isn't a cosmetic trade-off here — it silently cuts off part
// of the actual ad copy depending on the visitor's exact viewport. A
// blurred, zoomed copy of the same image fills the letterbox space behind
// it so there's never an empty black bar, while the sharp foreground copy
// always shows the whole, uncropped creative.
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
        {/* Blurred, scaled-up backdrop copy — fills the box completely so
            object-contain below never leaves a bare black gap on
            off-ratio uploads. Not shown to screen readers (decorative
            duplicate of the real image, which already has alt text). */}
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded creative is a compressed data: URL, next/image can't optimize it (same reasoning as AdThumbnailCard.tsx) */}
        <img
          src={creative.imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
        />

        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded creative is a compressed data: URL, next/image can't optimize it (same reasoning as AdThumbnailCard.tsx) */}
        <img
          src={creative.imageUrl}
          alt={creative.title || "Featured"}
          className="relative h-full w-full object-contain transition duration-500 group-hover:scale-[1.01]"
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
