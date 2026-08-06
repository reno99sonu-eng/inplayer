import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
    ],
    // Optimized thumbnails (Mux poster frames etc.) barely ever change for
    // a given URL — cache them at the CDN for 31 days instead of the short
    // default, so repeat visitors and busy pages stop re-optimizing the
    // same images over and over.
    minimumCacheTTL: 2678400,
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
};

export default nextConfig;
