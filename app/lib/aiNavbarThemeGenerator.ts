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

// Real, hand-designed SVG art for each of the six known preset occasions —
// deterministic on purpose, not an AI call, since a fixed known set of
// occasions is better served by curated art that's guaranteed to look right
// every time. Free-text "custom" occasions are handled separately by the
// real OpenAI-backed /api/admin/ai-navbar-theme-generate route (see
// app/admin/navbar-theme/page.tsx) — nothing here can be hardcoded for
// input nobody has typed yet.
export function generateAiNavbarThemeImage(occasionId: string): string {
  const width = 160;
  const height = 80;

  let themeGraphicSvg = "";

  if (occasionId === "independence_day") {
    // Pure Transparent Indian Flag Ribbon Wave & Glowing Ashoka Chakra
    themeGraphicSvg = `
      <defs>
        <linearGradient id="indFlag" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF9933" />
          <stop offset="50%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#138808" />
        </linearGradient>
        <filter id="indGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Waving Indian Tricolor Ribbon -->
      <path d="M 10 50 C 40 20, 80 70, 120 40 C 140 25, 150 30, 155 35 L 155 45 C 135 60, 80 20, 40 60 Z" fill="url(#indFlag)" opacity="0.95" />

      <!-- Glowing Navy Blue Ashoka Chakra -->
      <g transform="translate(65, 40)" filter="url(#indGlow)">
        <circle r="22" fill="#FFFFFF" opacity="0.9" />
        <circle r="20" fill="none" stroke="#000080" stroke-width="2.5" />
        <circle r="4" fill="#000080" />
        ${Array.from({ length: 24 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${18 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${
                18 * Math.sin((i * 15 * Math.PI) / 180)
              }" stroke="#000080" stroke-width="1.5" />`
          )
          .join("")}
      </g>

      <!-- Flying White Dove Silhouette -->
      <path d="M 125 22 C 135 15, 145 18, 152 28 C 144 29, 136 34, 130 40 C 127 34, 126 28, 125 22 Z" fill="#FFFFFF" opacity="0.9" />

      <!-- Celebration Sparkles -->
      <circle cx="25" cy="20" r="2.5" fill="#FF9933" />
      <circle cx="140" cy="65" r="2.5" fill="#138808" />
      <circle cx="150" cy="18" r="2" fill="#FFD700" />
    `;
  } else if (occasionId === "diwali") {
    // Pure Transparent Glowing Clay Diya Oil Lamp & Sparkles (No Background Box!)
    themeGraphicSvg = `
      <defs>
        <radialGradient id="diwaliFlameGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFF00" />
          <stop offset="40%" stop-color="#FF5500" />
          <stop offset="100%" stop-color="#FF5500" stop-opacity="0" />
        </radialGradient>
        <filter id="diwaliLightGlow">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(80, 52)">
        <!-- Outer Radiating Light Aura -->
        <circle cx="0" cy="-24" r="32" fill="url(#diwaliFlameGlow)" filter="url(#diwaliLightGlow)" opacity="0.9" />
        
        <!-- Diya Clay Bowl -->
        <path d="M -34 0 C -34 22, 34 22, 34 0 C 20 -4, -20 -4, -34 0 Z" fill="#D97706" stroke="#FDE047" stroke-width="2" />
        <ellipse cx="0" cy="0" rx="30" ry="5.5" fill="#92400E" />

        <!-- Intricate Golden Carvings on Diya -->
        <path d="M -22 8 Q 0 16, 22 8" fill="none" stroke="#FDE047" stroke-width="1.5" />
        <circle cx="0" cy="11" r="2" fill="#FEF08A" />
        <circle cx="-12" cy="9" r="1.5" fill="#FEF08A" />
        <circle cx="12" cy="9" r="1.5" fill="#FEF08A" />

        <!-- Real Burning Flame -->
        <path d="M 0 -36 C 10 -20, 8 -4, 0 0 C -8 -4, -10 -20, 0 -36 Z" fill="#FACC15" filter="url(#diwaliLightGlow)" />
        <path d="M 0 -28 C 5 -16, 4 -4, 0 0 C -4 -4, -5 -16, 0 -28 Z" fill="#FFFFFF" />
      </g>

      <!-- Surrounding Golden Sparkle Stars -->
      <g fill="#FDE047" opacity="0.85">
        <circle cx="28" cy="22" r="2" />
        <circle cx="132" cy="24" r="2.5" />
        <circle cx="40" cy="58" r="1.5" />
        <circle cx="122" cy="56" r="1.5" />
        <circle cx="80" cy="10" r="2" />
      </g>
    `;
  } else if (occasionId === "holi") {
    // Pure Transparent Vibrant Holi Gulal Color Splash
    themeGraphicSvg = `
      <defs>
        <filter id="holiBlur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <!-- Powder Splash Clouds -->
      <circle cx="60" cy="40" r="26" fill="#EC4899" opacity="0.85" filter="url(#holiBlur)" />
      <circle cx="85" cy="32" r="24" fill="#FACC15" opacity="0.85" filter="url(#holiBlur)" />
      <circle cx="105" cy="46" r="25" fill="#06B6D4" opacity="0.85" filter="url(#holiBlur)" />
      <circle cx="75" cy="54" r="22" fill="#10B981" opacity="0.8" filter="url(#holiBlur)" />

      <!-- Splatter Drops -->
      <circle cx="30" cy="24" r="4" fill="#F43F5E" />
      <circle cx="42" cy="56" r="3" fill="#A855F7" />
      <circle cx="135" cy="28" r="4.5" fill="#3B82F6" />
      <circle cx="125" cy="58" r="3.5" fill="#F59E0B" />
      <circle cx="145" cy="44" r="2.5" fill="#EC4899" />
    `;
  } else if (occasionId === "republic_day") {
    // Pure Transparent Republic Day IAF Jet Smoke Trails & Ashoka Emblem
    themeGraphicSvg = `
      <defs>
        <filter id="repGlow">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <!-- Jet Smoke Trails -->
      <path d="M 10 25 Q 80 50, 150 15" fill="none" stroke="#FF9933" stroke-width="5" opacity="0.9" />
      <path d="M 10 40 Q 80 65, 150 30" fill="none" stroke="#FFFFFF" stroke-width="5" opacity="0.95" />
      <path d="M 10 55 Q 80 80, 150 45" fill="none" stroke="#138808" stroke-width="5" opacity="0.9" />

      <!-- Ashoka Emblem -->
      <g transform="translate(80, 40)" filter="url(#repGlow)">
        <circle r="16" fill="#FFFFFF" />
        <circle r="14" fill="none" stroke="#000080" stroke-width="2" />
        ${Array.from({ length: 12 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${12 * Math.cos((i * 30 * Math.PI) / 180)}" y2="${
                12 * Math.sin((i * 30 * Math.PI) / 180)
              }" stroke="#000080" stroke-width="1.5" />`
          )
          .join("")}
      </g>
    `;
  } else if (occasionId === "new_year") {
    // Pure Transparent Golden Fireworks & Confetti Sparkles
    themeGraphicSvg = `
      <defs>
        <filter id="nySparkle">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Exploding Firework Starburst -->
      <g transform="translate(80, 40)" filter="url(#nySparkle)">
        ${Array.from({ length: 12 })
          .map(
            (_, i) =>
              `<line x1="0" y1="0" x2="${28 * Math.cos((i * 30 * Math.PI) / 180)}" y2="${
                28 * Math.sin((i * 30 * Math.PI) / 180)
              }" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" />`
          )
          .join("")}
        <circle r="6" fill="#FFF" />
      </g>

      <!-- Streamers & Floating Confetti -->
      <path d="M 25 15 Q 40 40, 20 65" fill="none" stroke="#F43F5E" stroke-width="2.5" stroke-linecap="round" />
      <path d="M 135 15 Q 120 40, 140 65" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="35" cy="25" r="3" fill="#34D399" />
      <circle cx="125" cy="22" r="3" fill="#F43F5E" />
      <circle cx="145" cy="50" r="2.5" fill="#FBBF24" />
    `;
  } else if (occasionId === "cyberpunk") {
    // Pure Transparent Cyberpunk Neon Laser Node
    themeGraphicSvg = `
      <defs>
        <filter id="cybGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Laser Beam Node -->
      <g transform="translate(80, 40)" filter="url(#cybGlow)">
        <circle r="22" fill="none" stroke="#06B6D4" stroke-width="2.5" />
        <circle r="14" fill="none" stroke="#EC4899" stroke-width="2" />
        <circle r="6" fill="#06B6D4" />
        <path d="M -45 0 L 45 0 M 0 -35 L 0 35" stroke="#06B6D4" stroke-width="1.5" opacity="0.8" />
      </g>
    `;
  } else {
    // Custom Occasion Transparent Festive Sparkle
    themeGraphicSvg = `
      <defs>
        <filter id="custGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(80, 40)" filter="url(#custGlow)">
        <path d="M 0 -25 L 6 -6 L 25 0 L 6 6 L 0 25 L -6 6 L -25 0 L -6 -6 Z" fill="#F43F5E" />
        <circle r="5" fill="#FFF" />
      </g>
      <circle cx="35" cy="25" r="3" fill="#FBBF24" />
      <circle cx="125" cy="55" r="3" fill="#3B82F6" />
    `;
  }

  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${themeGraphicSvg}
  </svg>`;

  const base64 = safeBase64Encode(fullSvg);
  return `data:image/svg+xml;base64,${base64}`;
}
