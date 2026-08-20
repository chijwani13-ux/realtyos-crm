import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chijwani RealTech OS",
    short_name: "RealTech OS",
    description: "Real estate CRM for leads, buyers, builders, and projects",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F7F5",
    theme_color: "#122142",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
