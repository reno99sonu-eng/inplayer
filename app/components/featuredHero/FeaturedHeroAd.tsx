"use client";

import { useState } from "react";

interface FeaturedHeroAdCreative {
  adId: string;
  imageUrl: string;
  imageUrlDesktop?: string;
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
// TWO images, not one. This box's own aspect ratio isn't fixed — it's a
// short, wide shape on mobile (min-h-[220px] at whatever width the phone
// is) but a MUCH wider strip on desktop/TV (lg+ switches to viewport-
// height sizing, so a 1920-wide 16:9 monitor renders roughly a 4.7:1 box,
// and ultra-wide/4K screens go even wider) — no single upload can ever
// fill both shapes edge-to-edge without heavy letterboxing on one end.
// Admin Panel -> Advertising -> Weekly Featured Banner now has two
// separate upload slots for exactly this reason: imageUrl (mobile &
// tablet/iPad) and imageUrlDesktop (desktop & smart TV, optional). Below
// lg (1024px, the same breakpoint where the box's own sizing model
// switches from min-height to viewport-height) the mobile image shows;
// at lg and above, the desktop image shows if one was uploaded, falling
// back to the mobile image otherwise so older creatives that only ever
// had one image keep working exactly as before.
//
// Each variant uses object-contain for its sharp foreground copy (never
// crops — ad creatives bake their headline/CTA copy directly into the
// image pixels, so cropping would silently cut off real ad copy) with a
// blurred, scaled-up backdrop copy of the SAME image filling the
// letterbox space behind it, so there's never an empty black bar even
// when an image's own proportions don't perfectly match its slot.
export default function FeaturedHeroAd({
  creative,
}: {
  creative: FeaturedHeroAdCreative;
}) {
  const mobileUrl = creative.imageUrl;
  const desktopUrl = creative.imageUrlDesktop || creative.imageUrl;

  const handleClick = () => {
    // Fire-and-forget, same as AdBanner.tsx's other placements — never
    // delays or blocks the actual navigation.
    fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId: creative.adId }),
    }).catch(() => {});
  };

  if (!mobileUrl && !desktopUrl) return null;

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
      {/* absolute inset-0 (not relative + h-full/w-full) so this anchors
          directly to the section's real, fully-resolved box on every
          breakpoint instead of an in-flow percentage height that can't
          resolve against a min-height-only parent (mobile/sm/md have no
          explicit `height`, only `min-h-[...]`) — see FeaturedHeroVideo.tsx
          for the same technique. */}
      <a
        href={creative.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="group absolute inset-0 block h-full w-full"
      >
        {mobileUrl && (
          <FeaturedHeroAdImage src={mobileUrl} title={creative.title} className="absolute inset-0 lg:hidden" />
        )}
        {desktopUrl && (
          <FeaturedHeroAdImage src={desktopUrl} title={creative.title} className="absolute inset-0 hidden lg:block" />
        )}

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

// One image variant (mobile OR desktop) — its own broken-image guard so a
// corrupted/failed-to-decode upload on ONE variant only ever blanks that
// variant, never the other one a visitor on a different device is
// actually seeing. Matches AdThumbnailCard.tsx's established guard
// pattern: once a real load failure is detected, render nothing instead
// of leaving a broken black block.
function FeaturedHeroAdImage({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className: string;
}) {
  const [broken, setBroken] = useState(false);

  if (broken) return null;

  return (
    <div className={className}>
      {/* Blurred, scaled-up backdrop copy — fills the box completely so
          object-contain below never leaves a bare black gap on off-ratio
          uploads. Not shown to screen readers (decorative duplicate of the
          real image, which already has alt text). */}
      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded creative is a compressed data: URL, next/image can't optimize it (same reasoning as AdThumbnailCard.tsx) */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
      />

      {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded creative is a compressed data: URL, next/image can't optimize it (same reasoning as AdThumbnailCard.tsx) */}
      <img
        src={src}
        alt={title || "Featured"}
        onError={() => setBroken(true)}
        className="relative h-full w-full object-contain transition duration-500 group-hover:scale-[1.01]"
      />
    </div>
  );
}
