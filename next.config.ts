import type { NextConfig } from "next";

// cacheComponents is left off on purpose: every page here is per-user and
// dynamic (session cookie), so the classic dynamic rendering model is simpler.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
