export interface GeneratedNavbarTheme {
  themeId: string;
  occasionName: string;
  title: string;
  imageUrl: string;
  createdAt: string;
}

export const PRESET_OCCASIONS = [
  { id: "independence_day", name: "Independence Day 🇮🇳", color: "from-[#FF9933] via-[#FFFFFF] to-[#138808]" },
  { id: "diwali", name: "Diwali Festival of Lights 🪔", color: "from-[#FF5E00] via-[#9333EA] to-[#3B82F6]" },
  { id: "holi", name: "Holi Festival of Colors 🎨", color: "from-[#EC4899] via-[#8B5CF6] to-[#06B6D4]" },
  { id: "republic_day", name: "Republic Day 🇮🇳", color: "from-[#FF9933] via-[#000080] to-[#138808]" },
  { id: "new_year", name: "New Year Celebration 🎉", color: "from-[#F59E0B] via-[#EF4444] to-[#8B5CF6]" },
  { id: "cyberpunk", name: "Cyberpunk Tech Mode ⚡", color: "from-[#06B6D4] via-[#3B82F6] to-[#EC4899]" },
] as const;

function safeBase64Encode(str: string): string {
  try {
    if (typeof window !== "undefined" && typeof btoa !== "undefined") {
      return btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );
    }
  } catch {
    /* fallback to Buffer */
  }
  return Buffer.from(str, "utf-8").toString("base64");
}

export function generateAiNavbarThemeImage(occasionId: string, customPrompt?: string): string {
  const width = 1920;
  const height = 160;

  let themeGraphicSvg = "";

  if (occasionId === "independence_day") {
    // Independence Day Tiranga Flag, Ashoka Chakra, Flying Doves & Fireworks
    themeGraphicSvg = `
      <defs>
        <linearGradient id="flagBg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF9933" />
          <stop offset="32%" stop-color="#FF9933" />
          <stop offset="48%" stop-color="#FFFFFF" />
          <stop offset="68%" stop-color="#138808" />
          <stop offset="100%" stop-color="#138808" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
          <stop offset="60%" stop-color="#FFD700" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#000080" stop-opacity="0" />
        </radialGradient>
        <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Indian Flag Backdrop Wave -->
      <rect width="${width}" height="${height}" fill="url(#flagBg)" opacity="0.92" />
      <path d="M 0 0 Q 480 80, 960 20 T 1920 40 L 1920 160 L 0 160 Z" fill="#138808" opacity="0.4" />
      <path d="M 0 0 Q 480 30, 960 70 T 1920 20 L 1920 0 L 0 0 Z" fill="#FF9933" opacity="0.4" />

      <!-- Glowing Central Ashoka Chakra -->
      <g transform="translate(960, 80)">
        <circle r="65" fill="url(#sunGlow)" />
        <circle r="52" fill="none" stroke="#000080" stroke-width="4" filter="url(#glowEffect)" />
        <circle r="46" fill="none" stroke="#000080" stroke-width="2" />
        <circle r="9" fill="#000080" />
        ${Array.from({ length: 24 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${46 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${
                46 * Math.sin((i * 15 * Math.PI) / 180)
              }" stroke="#000080" stroke-width="2.5" />`
          )
          .join("")}
      </g>

      <!-- Side Ashoka Chakras -->
      <g transform="translate(250, 80)" opacity="0.25">
        <circle r="40" fill="none" stroke="#000080" stroke-width="3" />
        ${Array.from({ length: 24 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${35 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${
                35 * Math.sin((i * 15 * Math.PI) / 180)
              }" stroke="#000080" stroke-width="2" />`
          )
          .join("")}
      </g>
      <g transform="translate(1670, 80)" opacity="0.25">
        <circle r="40" fill="none" stroke="#000080" stroke-width="3" />
        ${Array.from({ length: 24 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${35 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${
                35 * Math.sin((i * 15 * Math.PI) / 180)
              }" stroke="#000080" stroke-width="2" />`
          )
          .join("")}
      </g>

      <!-- Flying Tricolor Doves Silhouette -->
      <path d="M 450 40 C 470 30, 490 35, 510 50 C 495 52, 480 60, 470 70 C 465 58, 455 48, 450 40 Z" fill="#FFFFFF" opacity="0.8" />
      <path d="M 1450 45 C 1470 35, 1490 40, 1510 55 C 1495 57, 1480 65, 1470 75 C 1465 63, 1455 53, 1450 45 Z" fill="#FFFFFF" opacity="0.8" />

      <!-- Fireworks & Celebration Lights -->
      <circle cx="120" cy="40" r="4" fill="#FFF" opacity="0.9" />
      <circle cx="380" cy="120" r="3" fill="#FFD700" opacity="0.8" />
      <circle cx="780" cy="30" r="5" fill="#FFF" opacity="0.9" filter="url(#glowEffect)" />
      <circle cx="1180" cy="130" r="4" fill="#FF9933" opacity="0.8" />
      <circle cx="1520" cy="35" r="4" fill="#138808" opacity="0.9" />
      <circle cx="1800" cy="110" r="3" fill="#FFF" opacity="0.9" />

      <!-- Banner Watermark Text -->
      <text x="960" y="148" font-family="system-ui, sans-serif" font-weight="900" font-size="14" fill="#000080" text-anchor="middle" letter-spacing="4" opacity="0.7">HAPPY INDEPENDENCE DAY • INDIA</text>
    `;
  } else if (occasionId === "diwali") {
    // Diwali Real Diya Lamps, Golden Rangoli Mandalas & Sky Fireworks
    themeGraphicSvg = `
      <defs>
        <linearGradient id="diwaliBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1A0222" />
          <stop offset="35%" stop-color="#4C0519" />
          <stop offset="70%" stop-color="#701A75" />
          <stop offset="100%" stop-color="#310E5A" />
        </linearGradient>
        <radialGradient id="flameGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFF00" />
          <stop offset="40%" stop-color="#FF5500" />
          <stop offset="100%" stop-color="#FF5500" stop-opacity="0" />
        </radialGradient>
        <filter id="diyaLight">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#diwaliBg)" opacity="0.95" />

      <!-- Golden Rangoli Mandalas Backdrop -->
      <g transform="translate(300, 80)" opacity="0.2">
        <circle r="70" fill="none" stroke="#FFD700" stroke-width="2" stroke-dasharray="8 4" />
        <circle r="50" fill="none" stroke="#FFD700" stroke-width="1.5" />
      </g>
      <g transform="translate(1620, 80)" opacity="0.2">
        <circle r="70" fill="none" stroke="#FFD700" stroke-width="2" stroke-dasharray="8 4" />
        <circle r="50" fill="none" stroke="#FFD700" stroke-width="1.5" />
      </g>

      <!-- Real Glowing Diya Lamps (Left, Center, Right) -->
      ${[350, 960, 1570]
        .map(
          (cx) => `
        <g transform="translate(${cx}, 100)">
          <!-- Flame Glow Radius -->
          <circle cx="0" cy="-35" r="45" fill="url(#flameGlow)" filter="url(#diyaLight)" opacity="0.85" />
          <!-- Diya Clay Bowl -->
          <path d="M -40 0 C -40 25, 40 25, 40 0 C 25 -5, -25 -5, -40 0 Z" fill="#D97706" stroke="#FEF08A" stroke-width="2" />
          <ellipse cx="0" cy="0" rx="36" ry="7" fill="#B45309" />
          <!-- Diya Flame -->
          <path d="M 0 -45 C 12 -25, 10 -5, 0 0 C -10 -5, -12 -25, 0 -45 Z" fill="#FACC15" filter="url(#diyaLight)" />
          <path d="M 0 -35 C 6 -20, 5 -5, 0 0 C -5 -5, -6 -20, 0 -35 Z" fill="#FFFFFF" />
        </g>
      `
        )
        .join("")}

      <!-- Sparkling Fireworks Burst -->
      ${Array.from({ length: 40 })
        .map(
          (_, i) =>
            `<circle cx="${(i * 48 + 30) % 1920}" cy="${(i * 27 + 10) % 160}" r="${(i % 3) + 1.5}" fill="#FDE047" opacity="${
              0.4 + (i % 6) * 0.1
            }" />`
        )
        .join("")}

      <!-- Watermark Title -->
      <text x="960" y="148" font-family="system-ui, sans-serif" font-weight="900" font-size="13" fill="#FDE047" text-anchor="middle" letter-spacing="4" opacity="0.8">HAPPY DIWALI • FESTIVAL OF LIGHTS</text>
    `;
  } else if (occasionId === "holi") {
    // Holi Vibrant Color Splash Gulal Explosion
    themeGraphicSvg = `
      <defs>
        <linearGradient id="holiBg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#BE185D" />
          <stop offset="25%" stop-color="#6B21A8" />
          <stop offset="50%" stop-color="#1D4ED8" />
          <stop offset="75%" stop-color="#047857" />
          <stop offset="100%" stop-color="#B45309" />
        </linearGradient>
        <filter id="splashBlur">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#holiBg)" opacity="0.9" />

      <!-- Powder Splash Explosions -->
      <circle cx="320" cy="80" r="100" fill="#EC4899" opacity="0.6" filter="url(#splashBlur)" />
      <circle cx="700" cy="60" r="110" fill="#FACC15" opacity="0.5" filter="url(#splashBlur)" />
      <circle cx="1200" cy="100" r="120" fill="#06B6D4" opacity="0.6" filter="url(#splashBlur)" />
      <circle cx="1650" cy="70" r="100" fill="#10B981" opacity="0.5" filter="url(#splashBlur)" />

      <!-- Splatter Drops -->
      ${Array.from({ length: 50 })
        .map(
          (_, i) =>
            `<circle cx="${(i * 38 + 15) % 1920}" cy="${(i * 19 + 20) % 160}" r="${(i % 5) + 2}" fill="${
              ["#F43F5E", "#A855F7", "#3B82F6", "#10B981", "#F59E0B"][i % 5]
            }" opacity="${0.6 + (i % 4) * 0.1}" />`
        )
        .join("")}

      <!-- Watermark Title -->
      <text x="960" y="148" font-family="system-ui, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF" text-anchor="middle" letter-spacing="4" opacity="0.9">HAPPY HOLI • FESTIVAL OF COLORS</text>
    `;
  } else if (occasionId === "republic_day") {
    // Republic Day Airforce Jet Smoke Trails & Ashoka Emblem
    themeGraphicSvg = `
      <defs>
        <linearGradient id="repBg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF9933" />
          <stop offset="35%" stop-color="#FF9933" />
          <stop offset="50%" stop-color="#FFFFFF" />
          <stop offset="65%" stop-color="#138808" />
          <stop offset="100%" stop-color="#138808" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#repBg)" opacity="0.9" />

      <!-- IAF Fighter Jet Smoke Trails -->
      <path d="M 0 40 Q 600 120, 1920 30" fill="none" stroke="#FF9933" stroke-width="12" opacity="0.4" />
      <path d="M 0 80 Q 600 140, 1920 70" fill="none" stroke="#FFFFFF" stroke-width="12" opacity="0.5" />
      <path d="M 0 120 Q 600 160, 1920 110" fill="none" stroke="#138808" stroke-width="12" opacity="0.4" />

      <!-- Central Ashoka Chakra -->
      <g transform="translate(960, 80)">
        <circle r="50" fill="none" stroke="#000080" stroke-width="3" />
        <circle r="8" fill="#000080" />
        ${Array.from({ length: 24 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${42 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${
                42 * Math.sin((i * 15 * Math.PI) / 180)
              }" stroke="#000080" stroke-width="2" />`
          )
          .join("")}
      </g>

      <!-- Watermark Title -->
      <text x="960" y="148" font-family="system-ui, sans-serif" font-weight="900" font-size="13" fill="#000080" text-anchor="middle" letter-spacing="4" opacity="0.8">HAPPY REPUBLIC DAY</text>
    `;
  } else if (occasionId === "new_year") {
    // New Year Golden Fireworks & 2026 Celebration Streamers
    themeGraphicSvg = `
      <defs>
        <linearGradient id="nyBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0F172A" />
          <stop offset="50%" stop-color="#31103F" />
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#nyBg)" opacity="0.95" />

      <!-- Golden Fireworks Stars -->
      ${Array.from({ length: 45 })
        .map(
          (_, i) =>
            `<circle cx="${(i * 43 + 20) % 1920}" cy="${(i * 29 + 15) % 160}" r="${(i % 4) + 1.5}" fill="#FBBF24" opacity="${
              0.5 + (i % 5) * 0.1
            }" />`
        )
        .join("")}

      <!-- Streamers -->
      <path d="M 150 0 Q 300 160, 450 0" fill="none" stroke="#F43F5E" stroke-width="2" opacity="0.6" />
      <path d="M 1400 0 Q 1550 160, 1700 0" fill="none" stroke="#3B82F6" stroke-width="2" opacity="0.6" />

      <!-- Watermark Title -->
      <text x="960" y="100" font-family="system-ui, sans-serif" font-weight="900" font-size="36" fill="#FBBF24" text-anchor="middle" letter-spacing="6" opacity="0.85">WELCOME 2026</text>
    `;
  } else if (occasionId === "cyberpunk") {
    // Cyberpunk Synthwave Grid & Neon Lasers
    themeGraphicSvg = `
      <defs>
        <linearGradient id="cybBg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#030712" />
          <stop offset="50%" stop-color="#0B132B" />
          <stop offset="100%" stop-color="#030712" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#cybBg)" />

      <!-- Cyber Neon Perspective Lines -->
      <path d="M 0 40 L 1920 40 M 0 80 L 1920 80 M 0 120 L 1920 120" stroke="#06B6D4" stroke-width="1" opacity="0.3" />
      <path d="M 0 0 L 960 160 L 1920 0" fill="none" stroke="#EC4899" stroke-width="2" opacity="0.6" />

      <!-- Laser Beam Node -->
      <circle cx="960" cy="80" r="50" fill="none" stroke="#06B6D4" stroke-width="2" opacity="0.7" />

      <!-- Watermark Title -->
      <text x="960" y="148" font-family="system-ui, sans-serif" font-weight="900" font-size="13" fill="#06B6D4" text-anchor="middle" letter-spacing="5" opacity="0.85">INPLAYER CYBERPUNK TECH MODE</text>
    `;
  } else {
    // Custom Celebration Prompt
    const customTitle = (customPrompt || "Custom Celebration")
      .replace(/[^\w\s-]/gi, "")
      .toUpperCase();
    themeGraphicSvg = `
      <defs>
        <linearGradient id="customBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1E1B4B" />
          <stop offset="50%" stop-color="#581C87" />
          <stop offset="100%" stop-color="#831843" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" fill="url(#customBg)" opacity="0.95" />

      <!-- Sparkling Light Flares -->
      ${Array.from({ length: 40 })
        .map(
          (_, i) =>
            `<circle cx="${(i * 48 + 20) % 1920}" cy="${(i * 23 + 15) % 160}" r="${(i % 4) + 2}" fill="#F43F5E" opacity="${
              0.4 + (i % 5) * 0.12
            }" />`
        )
        .join("")}

      <!-- Custom Watermark Title -->
      <text x="960" y="100" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#FFFFFF" text-anchor="middle" letter-spacing="4" opacity="0.9">${customTitle}</text>
    `;
  }

  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${themeGraphicSvg}
  </svg>`;

  const base64 = safeBase64Encode(fullSvg);
  return `data:image/svg+xml;base64,${base64}`;
}
