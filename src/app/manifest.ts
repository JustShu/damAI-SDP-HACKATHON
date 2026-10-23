import type { MetadataRoute } from "next";

// Lets residents "Add to Home Screen" so DAMAI opens full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DAMAI · Neighbours at peace",
    short_name: "DAMAI",
    description: "Raise neighbourhood concerns privately and get urgent help from community management.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f3fb",
    theme_color: "#1d1752",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
