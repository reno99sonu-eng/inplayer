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

export function generateAiNavbarThemeImage(occasionId: string, customPrompt?: string): string {
  const width = 1920;
  const height = 120;
  const occasion = PRESET_OCCASIONS.find((o) => o.id === occasionId) || {
    id: "custom",
    name: customPrompt || "Custom Celebration",
    color: "from-indigo-600 via-purple-600 to-pink-600",
  };

  let themeGraphicSvg = "";

  if (occasionId === "independence_day" || occasionId === "republic_day") {
    themeGraphicSvg = `
      <defs>
        <linearGradient id="flagGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FF9933" stop-opacity="0.9" />
          <stop offset="35%" stop-color="#FF9933" stop-opacity="0.3" />
          <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.15" />
          <stop offset="65%" stop-color="#138808" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#138808" stop-opacity="0.9" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#flagGrad)" />
      
      <!-- Ashoka Chakra Watermark Elements -->
      <g opacity="0.15" transform="translate(960, 60)">
        <circle r="45" fill="none" stroke="#000080" stroke-width="2.5" />
        <circle r="8" fill="#000080" />
        ${Array.from({ length: 24 })
          .map((_, i) => `<line x1="0" y1="0" x2="${45 * Math.cos((i * 15 * Math.PI) / 180)}" y2="${45 * Math.sin((i * 15 * Math.PI) / 180)}" stroke="#000080" stroke-width="1.5" />`)
          .join("")}
      </g>
      <g opacity="0.12" transform="translate(200, 60)">
        <circle r="35" fill="none" stroke="#000080" stroke-width="2" />
      </g>
      <g opacity="0.12" transform="translate(1720, 60)">
        <circle r="35" fill="none" stroke="#000080" stroke-width="2" />
      </g>

      <!-- Sparkling Stars & Fireworks -->
      <circle cx="150" cy="30" r="3" fill="#FFF" opacity="0.8" />
      <circle cx="380" cy="80" r="2.5" fill="#FFD700" opacity="0.7" />
      <circle cx="820" cy="25" r="3.5" fill="#FFF" opacity="0.9" filter="url(#glow)" />
      <circle cx="1150" cy="90" r="2" fill="#FF9933" opacity="0.8" />
      <circle cx="1540" cy="35" r="3" fill="#138808" opacity="0.8" />
      <circle cx="1780" cy="85" r="2" fill="#FFF" opacity="0.9" />
    `;
  } else if (occasionId === "diwali") {
    themeGraphicSvg = `
      <defs>
        <linearGradient id="diwaliGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#31103F" />
          <stop offset="30%" stop-color="#701A75" />
          <stop offset="60%" stop-color="#C026D3" />
          <stop offset="85%" stop-color="#EA580C" />
          <stop offset="100%" stop-color="#CA8A04" />
        </linearGradient>
        <radialGradient id="diyaGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FDE047" stop-opacity="1" />
          <stop offset="50%" stop-color="#F97316" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#F97316" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#diwaliGrad)" opacity="0.85" />
      
      <!-- Diya Sparks & Rangoli Bokeh Circles -->
      <circle cx="250" cy="60" r="40" fill="url(#diyaGlow)" opacity="0.6" />
      <circle cx="960" cy="60" r="60" fill="url(#diyaGlow)" opacity="0.5" />
      <circle cx="1670" cy="60" r="40" fill="url(#diyaGlow)" opacity="0.6" />

      <!-- Sparkling Light Particles -->
      ${Array.from({ length: 30 })
        .map(
          (_, i) =>
            `<circle cx="${(i * 65 + 40) % 1920}" cy="${(i * 23 + 15) % 120}" r="${(i % 3) + 1.5}" fill="#FDE047" opacity="${0.4 + (i % 5) * 0.12}" />`
        )
        .join("")}
    `;
  } else if (occasionId === "holi") {
    themeGraphicSvg = `
      <defs>
        <linearGradient id="holiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#DB2777" />
          <stop offset="25%" stop-color="#9333EA" />
          <stop offset="50%" stop-color="#2563EB" />
          <stop offset="75%" stop-color="#059669" />
          <stop offset="100%" stop-color="#D97706" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#holiGrad)" opacity="0.75" />
      
      <!-- Color Powder Splashes -->
      <ellipse cx="300" cy="60" rx="90" ry="40" fill="#EC4899" opacity="0.4" filter="blur(10px)" />
      <ellipse cx="850" cy="40" rx="110" ry="50" fill="#8B5CF6" opacity="0.4" filter="blur(12px)" />
      <ellipse cx="1400" cy="80" rx="100" ry="45" fill="#06B6D4" opacity="0.4" filter="blur(10px)" />
    `;
  } else if (occasionId === "cyberpunk") {
    themeGraphicSvg = `
      <defs>
        <linearGradient id="cyberGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#030712" />
          <stop offset="40%" stop-color="#083344" />
          <stop offset="70%" stop-color="#31103F" />
          <stop offset="100%" stop-color="#030712" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#cyberGrad)" />
      
      <!-- Cyber Neon Lines -->
      <path d="M 0 30 Q 400 90, 960 30 T 1920 60" fill="none" stroke="#06B6D4" stroke-width="2" opacity="0.6" />
      <path d="M 0 90 Q 600 20, 1200 100 T 1920 40" fill="none" stroke="#EC4899" stroke-width="2" opacity="0.5" />
    `;
  } else {
    // New Year / Custom
    themeGraphicSvg = `
      <defs>
        <linearGradient id="festiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1E1B4B" />
          <stop offset="50%" stop-color="#4C1D95" />
          <stop offset="100%" stop-color="#831843" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#festiveGrad)" opacity="0.8" />
      ${Array.from({ length: 25 })
        .map(
          (_, i) =>
            `<circle cx="${(i * 77 + 20) % 1920}" cy="${(i * 19 + 10) % 120}" r="${(i % 4) + 1.5}" fill="#F43F5E" opacity="${0.4 + (i % 4) * 0.15}" />`
        )
        .join("")}
    `;
  }

  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${themeGraphicSvg}
  </svg>`;

  const base64 = typeof btoa !== "undefined" ? btoa(fullSvg) : Buffer.from(fullSvg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
