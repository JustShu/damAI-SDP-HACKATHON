import type { NextConfig } from "next";

// cacheComponents is left off on purpose: every page here is per-user and
// dynamic (session cookie), so the classic dynamic rendering model is simpler.
const nextConfig: NextConfig = {
  turbopack: {
    // Always this folder, even if a parent folder has its own package.json or
    // lockfile (e.g. when the project is unzipped inside another project).
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
