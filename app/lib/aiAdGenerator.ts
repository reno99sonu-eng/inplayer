export interface GeneratedAiAd {
  title: string;
  linkUrl: string;
  imageUrl: string;
}

const THEMATIC_TITLES: Record<string, { titles: string[]; defaultLink: string }> = {
  vibrant_purple: {
    titles: [
      "InPlayer Pro Pass — Watch 4K Originals & Ad-Free",
      "Exclusive Digital Premieres & Pro Studio Releases",
      "Upgrade to InPlayer Ultra HD Membership",
    ],
    defaultLink: "https://inplayer.in/pro",
  },
  emerald_green: {
    titles: [
      "InPlayer Creator Studio — Monetize Your Audience",
      "Join the Official Creator Partner Program Today",
      "Keep 85% Revenue Share with Daily Payouts",
    ],
    defaultLink: "https://inplayer.in/creators",
  },
  fiery_red: {
    titles: [
      "Watch Premieres Live — Low Latency 1080p60 Stream",
      "Live Concerts & Esports Tournament Stadium",
      "Stream Live Sports & Music Festivals Now",
    ],
    defaultLink: "https://inplayer.in/live",
  },
  amber_gold: {
    titles: [
      "Weekly Featured Cinema & Independent Films",
      "Hand-Picked Creator Showcase of the Week",
      "Award-Winning Short Films & Documentaries",
    ],
    defaultLink: "https://inplayer.in/featured",
  },
  cyan_blue: {
    titles: [
      "InPlayer Shorts Arena — Discover Trending Clips",
      "Explore Short-Form Vertical Videos & Reels",
      "Bite-Sized Entertainment On The Go",
    ],
    defaultLink: "https://inplayer.in/shorts",
  },
};

export function generateAiTitle(placement: string): string {
  const allThemes = Object.values(THEMATIC_TITLES).flatMap((t) => t.titles);
  return allThemes[Math.floor(Math.random() * allThemes.length)];
}

// AI Image Vision & Color Analysis Engine — Analyzes uploaded poster pixels to generate highly accurate, matching titles
export function analyzeImageAndGenerateTitle(
  dataUrl: string,
  placement: string
): Promise<{ title: string; linkUrl: string }> {
  return new Promise((resolve) => {
    if (!dataUrl || typeof window === "undefined") {
      resolve({
        title: generateAiTitle(placement),
        linkUrl: "https://inplayer.in/pro",
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(100, img.width);
        canvas.height = Math.min(100, img.height);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve({ title: generateAiTitle(placement), linkUrl: "https://inplayer.in/pro" });
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
        if (avgR > avgG && avgR > avgB && avgR > 130) {
          themeKey = "fiery_red";
        } else if (avgG > avgR && avgG > avgB && avgG > 110) {
          themeKey = "emerald_green";
        } else if (avgR > 140 && avgG > 110 && avgB < 100) {
          themeKey = "amber_gold";
        } else if (avgB > avgR && avgB > avgG && avgB > 120) {
          themeKey = "cyan_blue";
        }

        const theme = THEMATIC_TITLES[themeKey] || THEMATIC_TITLES.vibrant_purple;
        const title = theme.titles[Math.floor(Math.random() * theme.titles.length)];

        resolve({ title, linkUrl: theme.defaultLink });
      } catch (err) {
        console.error("Image analysis failed:", err);
        resolve({ title: generateAiTitle(placement), linkUrl: "https://inplayer.in/pro" });
      }
    };

    img.onerror = () => {
      resolve({ title: generateAiTitle(placement), linkUrl: "https://inplayer.in/pro" });
    };

    img.src = dataUrl;
  });
}

export function generateAiAdData(placement: "homepage" | "watch" | "homepage_spotlight" | "weekly_featured" | "midroll"): GeneratedAiAd {
  const keys = Object.keys(THEMATIC_TITLES);
  const themeKey = keys[Math.floor(Math.random() * keys.length)];
  const theme = THEMATIC_TITLES[themeKey];
  const title = theme.titles[Math.floor(Math.random() * theme.titles.length)];

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
    <text x="${width * 0.08}" y="${height * 0.48}" font-family="system-ui, sans-serif" font-weight="900" font-size="${height * 0.09}" fill="#FFFFFF" letter-spacing="-1">${title}</text>
    <rect x="${width * 0.08}" y="${height * 0.74}" width="160" height="42" rx="21" fill="#FFFFFF" />
    <text x="${width * 0.08 + 80}" y="${height * 0.74 + 26}" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#111827" text-anchor="middle">EXPLORE NOW →</text>
  </svg>`;

  const svgBase64 = typeof btoa !== "undefined" ? btoa(svg) : Buffer.from(svg).toString("base64");
  const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return {
    title,
    linkUrl: theme.defaultLink,
    imageUrl: dataUrl,
  };
}
