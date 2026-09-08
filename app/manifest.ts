import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rhythians",
    short_name: "Rhythians",
    description: "Rhythia community platform for maps, progression, battles, tournaments, clips, and community tools.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0f19",
    theme_color: "#0b0f19",
    orientation: "any",
    categories: ["games", "social"],
    icons: [
      { src: "/favicon.ico", sizes: "192x192", type: "image/x-icon" },
      { src: "/favicon.ico", sizes: "512x512", type: "image/x-icon" },
    ],
  };
}
