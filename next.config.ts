import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gzip compress all responses for faster transfer
  compress: true,

  // Remove X-Powered-By header (smaller responses + security)
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
      {
        protocol: "https",
        hostname: "img.gamemonetize.com",
      },
    ],
    // Optimized thumbnails (Mux poster frames etc.) barely ever change for
    // a given URL — cache them at the CDN for 31 days instead of the short
    // default, so repeat visitors and busy pages stop re-optimizing the
    // same images over and over.
    minimumCacheTTL: 2678400,
    // Serve modern formats first
    formats: ["image/avif", "image/webp"],
  },

  // Tree-shake heavy barrel-export libraries so only the specific
  // icons/components actually used end up in the client bundle, instead of
  // the entire library. Without this, lucide-react alone can add 200KB+
  // and @aws-amplify/ui-react even more.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@aws-amplify/ui-react",
    ],
  },

  // Aggressive caching for immutable static assets
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
