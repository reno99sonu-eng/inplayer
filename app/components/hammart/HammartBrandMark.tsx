"use client";

import { useState } from "react";
import { Store } from "lucide-react";

// The Ham Mart brand badge shown in the Hammart storefront header
// (app/shop/page.tsx). Pulled into its own tiny component purely so the
// missing-file fallback below can own a piece of state without turning the
// whole shop page into something that re-renders for it.
//
// Responsive by height with w-auto, so the badge scales with the header on
// every screen instead of forcing a fixed box: h-9 on a phone, h-11 from
// the `sm` breakpoint, h-14 on desktop. `flex-shrink-0` keeps it from being
// squashed when the header's flex row gets tight on a narrow screen.
//
// `rounded-xl` is intentional insurance: if the supplied PNG turns out to
// have a solid white background rather than a transparent one, it reads as
// a deliberate rounded tile against the cream/dark header rather than a raw
// white rectangle. A transparent PNG still looks completely normal with it.
//
// If /logos/hammart-logo.png is absent (or fails to load for any reason),
// this falls straight back to the original lucide <Store /> icon the header
// used before — so a missing asset degrades to exactly the previous design
// instead of leaving a broken-image placeholder in the storefront header.
const HAMMART_LOGO_SRC = "/logos/hammart-logo.png";

export default function HammartBrandMark() {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoFailed) {
    return <Store className="text-orange-400 flex-shrink-0" size={22} />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- plain <img>
       matches how every other brand lockup in this app is rendered
       (NavbarLogo.tsx, SplashScreen.tsx), and needs the onError hook. */
    <img
      src={HAMMART_LOGO_SRC}
      alt="Ham Mart"
      draggable={false}
      onError={() => setLogoFailed(true)}
      className="h-9 sm:h-11 lg:h-14 w-auto flex-shrink-0 rounded-xl object-contain"
    />
  );
}
