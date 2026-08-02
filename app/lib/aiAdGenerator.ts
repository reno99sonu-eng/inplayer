export interface GeneratedAiAd {
  title: string;
  linkUrl: string;
  imageUrl: string;
}

const PLACEMENT_TITLES: Record<string, string[]> = {
  homepage: [
    "InPlayer Pro Pass — Stream Unlimited 4K Ad-Free",
    "Discover Top Trending Creators Across India",
    "Join the InPlayer Creator Monetization Program",
    "Watch Premieres Live in 1080p60 Low Latency",
  ],
  watch: [
    "Upgrade to InPlayer Premium — No Playback Interruptions",
    "Support Creator Channels Directly with Super Thanks",
    "Stream Official Music Videos & Originals in HD",
  ],
  weekly_featured: [
    "Weekly Featured Showcase — Top Rated Films of the Week",
    "Curated Independent Filmmakers Spotlight",
    "Weekly Blockbuster Premiere — Watch Now Exclusively",
  ],
  homepage_spotlight: [
    "InPlayer Shorts Festival — Watch Trending Clips Now",
    "Live Gaming Arenas & Esports Streams",
    "Official Studio Releases & Exclusive Documentaries",
  ],
  midroll: [
    "InPlayer Pro — Skip All Mid-Roll Ads Forever",
    "Download Videos for Offline Playback on Mobile",
    "Support Your Favorite Creators with Monthly Memberships",
  ],
};

const SAMPLE_PROMOS = [
  {
    title: "InPlayer Pro Pass — Watch 4K Ad-Free",
    linkUrl: "https://inplayer.in/pro",
    tagline: "UNLIMITED 4K STREAMING",
    subtext: "Cancel anytime • Only ₹99/mo",
    badge: "PRO OFFER",
    bgGradient: ["#4F46E5", "#7C3AED", "#DB2777"],
  },
  {
    title: "InPlayer Creator Studio & Monetization",
    linkUrl: "https://inplayer.in/creators",
    tagline: "EARN FROM YOUR VIDEOS",
    subtext: "Keep 85% revenue share with daily payouts",
    badge: "CREATORS",
    bgGradient: ["#059669", "#0D9488", "#2563EB"],
  },
  {
    title: "Stream Premieres Live on InPlayer",
    linkUrl: "https://inplayer.in/live",
    tagline: "LIVE STREAMING ENGINE",
    subtext: "Low-latency 1080p60 broadcasting",
    badge: "LIVE NOW",
    bgGradient: ["#DC2626", "#EA580C", "#D97706"],
  },
  {
    title: "InPlayer Shorts Arena — Trending Clips",
    linkUrl: "https://inplayer.in/shorts",
    tagline: "EXPLORE SHORTS",
    subtext: "Bite-sized vertical video content",
    badge: "TRENDING",
    bgGradient: ["#891C69", "#C026D3", "#4F46E5"],
  },
  {
    title: "Weekly Exclusive Content Festival",
    linkUrl: "https://inplayer.in/festival",
    tagline: "WEEKLY FEATURED FESTIVAL",
    subtext: "Hand-picked independent creators",
    badge: "FEATURED",
    bgGradient: ["#1E1B4B", "#312E81", "#6366F1"],
  },
];

export function generateAiTitle(placement: string): string {
  const titles = PLACEMENT_TITLES[placement] || PLACEMENT_TITLES.homepage;
  return titles[Math.floor(Math.random() * titles.length)];
}

export function generateAiAdData(placement: "homepage" | "watch" | "homepage_spotlight" | "weekly_featured" | "midroll"): GeneratedAiAd {
  const promo = SAMPLE_PROMOS[Math.floor(Math.random() * SAMPLE_PROMOS.length)];
  
  let width = 1200;
  let height = 375;
  if (placement === "midroll" || placement === "homepage_spotlight") {
    width = 1200;
    height = 675;
  } else if (placement === "weekly_featured") {
    width = 1920;
    height = 600;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${promo.bgGradient[0]}" />
        <stop offset="50%" stop-color="${promo.bgGradient[1]}" />
        <stop offset="100%" stop-color="${promo.bgGradient[2]}" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad)" />
    <rect width="${width}" height="${height}" fill="url(#grid)" />
    
    <circle cx="${width * 0.85}" cy="${height * 0.3}" r="${height * 0.4}" fill="rgba(255,255,255,0.08)" filter="blur(20px)" />
    
    <rect x="${width * 0.08}" y="${height * 0.18}" width="120" height="32" rx="16" fill="rgba(255,255,255,0.2)" />
    <text x="${width * 0.08 + 60}" y="${height * 0.18 + 21}" font-family="system-ui, sans-serif" font-weight="900" font-size="12" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">${promo.badge}</text>
    
    <text x="${width * 0.08}" y="${height * 0.48}" font-family="system-ui, sans-serif" font-weight="900" font-size="${height * 0.12}" fill="#FFFFFF" letter-spacing="-1">${promo.tagline}</text>
    
    <text x="${width * 0.08}" y="${height * 0.68}" font-family="system-ui, sans-serif" font-weight="500" font-size="${height * 0.055}" fill="rgba(255,255,255,0.85)">${promo.subtext}</text>
    
    <rect x="${width * 0.08}" y="${height * 0.78}" width="160" height="42" rx="21" fill="#FFFFFF" />
    <text x="${width * 0.08 + 80}" y="${height * 0.78 + 26}" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#111827" text-anchor="middle">EXPLORE NOW →</text>
  </svg>`;

  const svgBase64 = typeof btoa !== "undefined" ? btoa(svg) : Buffer.from(svg).toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return {
    title: generateAiTitle(placement),
    linkUrl: promo.linkUrl,
    imageUrl: dataUrl,
  };
}
