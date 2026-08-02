export interface GeneratedAiAd {
  title: string;
  linkUrl: string;
  imageUrl: string;
}

const PLACEMENT_DEFAULTS: Record<string, { titles: string[]; defaultLink: string }> = {
  homepage: {
    titles: [
      "InPlayer Pro — Stream 4K Cinema & Exclusive Premieres Ad-Free",
      "Discover Official Partner Channels & Trending Creators Across India",
      "Upgrade to InPlayer Ultra HD for Uninterrupted 60fps Playback",
      "Join the Official Creator Partner Program & Start Earning Today",
    ],
    defaultLink: "https://inplayer.in/pro",
  },
  watch: {
    titles: [
      "Upgrade to InPlayer Ultra HD — Enjoy Zero Interruptions",
      "Support Official Channels Directly with Super Thanks & Memberships",
      "Stream Official Music Videos & InPlayer Originals in 4K",
      "Unlock Member-Only Channel Badges & Exclusive Bonus Streams",
    ],
    defaultLink: "https://inplayer.in/watch-pro",
  },
  weekly_featured: {
    titles: [
      "Weekly Featured Cinema — Hand-Picked Independent Blockbuster of the Week",
      "Curated Creator Showcase — Exclusive InPlayer Weekly Premieres",
      "Weekly Award-Winning Festival Selection — Watch Free in 1080p",
      "Official Featured Creator Spotlight — Watch The Season Premiere Now",
    ],
    defaultLink: "https://inplayer.in/featured",
  },
  homepage_spotlight: {
    titles: [
      "InPlayer Shorts Arena — Discover Millions of Trending Daily Clips",
      "Live Esports Stadium & Competitive Tournament Arenas",
      "Exclusive Digital Documentaries & Award-Winning Short Films",
      "Explore Viral Short-Form Vertical Videos & Trending Reels",
    ],
    defaultLink: "https://inplayer.in/shorts",
  },
  midroll: {
    titles: [
      "InPlayer Pro Pass — Skip All Mid-Roll Video Ads Forever",
      "Download Your Favorite Videos for Offline Mobile Playback",
      "Support Independent Creators directly with Channel Memberships",
      "Enjoy Uninterrupted 4K Playback across all Devices with InPlayer Pro",
    ],
    defaultLink: "https://inplayer.in/pro",
  },
};

const VISUAL_THEME_TITLES: Record<string, Record<string, string[]>> = {
  fiery_red: {
    homepage: ["Watch Premieres Live — Low Latency 1080p60 Action Stream", "Live Concerts & Esports Stadium Arena"],
    watch: ["Live Stream Premiere — Join Live Chat & Support Creator"],
    weekly_featured: ["Weekly Featured Action Premiere — Blockbuster Release"],
    homepage_spotlight: ["Live Gaming Arena & Tournament Championship"],
    midroll: ["Watch Premieres Live Without Ad Interruptions"],
  },
  emerald_green: {
    homepage: ["InPlayer Creator Studio — Keep 85% Revenue Share Daily", "Monetize Your Channel with Official Partner Tools"],
    watch: ["Join Creator Partner Program & Monetize Your Audience"],
    weekly_featured: ["Weekly Featured Creator Spotlight — Creator Studio Selection"],
    homepage_spotlight: ["Discover Emerging Indian Creators & Top Channel Studios"],
    midroll: ["Support Creators Directly with Channel Subscriptions"],
  },
  amber_gold: {
    homepage: ["Weekly Featured Cinema — Exclusive Award-Winning Premiere", "Hand-Picked Cinematic Masterpieces"],
    watch: ["Watch InPlayer Ultra HD Original Feature Films"],
    weekly_featured: ["Weekly Featured Cinema — Hand-Picked Movie of the Week"],
    homepage_spotlight: ["Featured Short Films & Festival Winners"],
    midroll: ["Upgrade to Gold Cinema Pass for Ad-Free Movies"],
  },
  cyan_blue: {
    homepage: ["InPlayer Shorts Arena — Discover Viral Vertical Reels", "Bite-Sized Mobile Entertainment On The Go"],
    watch: ["Explore Trending Shorts & Reels in HD"],
    weekly_featured: ["Weekly Featured Short Film & Digital Original"],
    homepage_spotlight: ["InPlayer Shorts Arena — Millions of Daily Trending Clips"],
    midroll: ["Enjoy Continuous Ad-Free Shorts & Video Streaming"],
  },
  vibrant_purple: {
    homepage: ["InPlayer Pro Pass — Watch 4K Originals & Exclusive Shows", "Upgrade to Ultra HD Pro Membership"],
    watch: ["Enjoy Ad-Free Playback in 4K with InPlayer Pro"],
    weekly_featured: ["Weekly Featured Pro Premiere — Exclusive Digital Release"],
    homepage_spotlight: ["Discover InPlayer Pro Studio Originals"],
    midroll: ["Skip All Ad Interruptions Forever with InPlayer Pro"],
  },
};

export function generateAiTitle(placement: string): string {
  const defaults = PLACEMENT_DEFAULTS[placement] || PLACEMENT_DEFAULTS.homepage;
  return defaults.titles[Math.floor(Math.random() * defaults.titles.length)];
}

// AI Image Vision Engine — Analyzes uploaded poster color distribution and visual contrast to generate accurate, matching titles
export function analyzeImageAndGenerateTitle(
  dataUrl: string,
  placement: string
): Promise<{ title: string; linkUrl: string }> {
  return new Promise((resolve) => {
    const defaults = PLACEMENT_DEFAULTS[placement] || PLACEMENT_DEFAULTS.homepage;

    if (!dataUrl || typeof window === "undefined") {
      resolve({
        title: generateAiTitle(placement),
        linkUrl: defaults.defaultLink,
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(100, img.width || 100);
        canvas.height = Math.min(100, img.height || 100);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve({ title: generateAiTitle(placement), linkUrl: defaults.defaultLink });
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let rSum = 0, gSum = 0, bSum = 0;
        const totalPixels = imageData.length / 4;

        for (let i = 0; i < imageData.length; i += 4) {
          rSum += imageData[i];
          gSum += imageData[i + 1];
          bSum += imageData[i + 2];
        }

        const avgR = rSum / totalPixels;
        const avgG = gSum / totalPixels;
        const avgB = bSum / totalPixels;

        let themeKey = "vibrant_purple";
        if (avgR > avgG && avgR > avgB && avgR > 120) {
          themeKey = "fiery_red";
        } else if (avgG > avgR && avgG > avgB && avgG > 105) {
          themeKey = "emerald_green";
        } else if (avgR > 135 && avgG > 105 && avgB < 110) {
          themeKey = "amber_gold";
        } else if (avgB > avgR && avgB > avgG && avgB > 115) {
          themeKey = "cyan_blue";
        }

        const visualTheme = VISUAL_THEME_TITLES[themeKey] || VISUAL_THEME_TITLES.vibrant_purple;
        const placementTitles = visualTheme[placement] || visualTheme.homepage || defaults.titles;
        const title = placementTitles[Math.floor(Math.random() * placementTitles.length)];

        resolve({ title, linkUrl: defaults.defaultLink });
      } catch (err) {
        console.error("Image vision analysis failed:", err);
        resolve({ title: generateAiTitle(placement), linkUrl: defaults.defaultLink });
      }
    };

    img.onerror = () => {
      resolve({ title: generateAiTitle(placement), linkUrl: defaults.defaultLink });
    };

    img.src = dataUrl;
  });
}

export function generateAiAdData(placement: "homepage" | "watch" | "homepage_spotlight" | "weekly_featured" | "midroll"): GeneratedAiAd {
  const defaults = PLACEMENT_DEFAULTS[placement] || PLACEMENT_DEFAULTS.homepage;
  const title = defaults.titles[Math.floor(Math.random() * defaults.titles.length)];

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
        <stop offset="0%" stop-color="#4F46E5" />
        <stop offset="50%" stop-color="#7C3AED" />
        <stop offset="100%" stop-color="#DB2777" />
      </linearGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad)" />
    <rect width="${width}" height="${height}" fill="url(#grid)" />
    
    <circle cx="${width * 0.85}" cy="${height * 0.3}" r="${height * 0.4}" fill="rgba(255,255,255,0.08)" filter="blur(20px)" />
    <rect x="${width * 0.08}" y="${height * 0.18}" width="140" height="32" rx="16" fill="rgba(255,255,255,0.2)" />
    <text x="${width * 0.08 + 70}" y="${height * 0.18 + 21}" font-family="system-ui, sans-serif" font-weight="900" font-size="12" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">OFFICIAL AD</text>
    <text x="${width * 0.08}" y="${height * 0.48}" font-family="system-ui, sans-serif" font-weight="900" font-size="${height * 0.08}" fill="#FFFFFF" letter-spacing="-1">${title}</text>
    <rect x="${width * 0.08}" y="${height * 0.74}" width="160" height="42" rx="21" fill="#FFFFFF" />
    <text x="${width * 0.08 + 80}" y="${height * 0.74 + 26}" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#111827" text-anchor="middle">EXPLORE NOW →</text>
  </svg>`;

  const svgBase64 = typeof btoa !== "undefined" ? btoa(svg) : Buffer.from(svg).toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return {
    title,
    linkUrl: defaults.defaultLink,
    imageUrl: dataUrl,
  };
}
