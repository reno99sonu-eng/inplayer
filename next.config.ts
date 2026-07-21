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
};

export default nextConfig;
