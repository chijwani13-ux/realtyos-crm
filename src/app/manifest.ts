import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RealtyOS",
    short_name: "RealtyOS",
    description: "Real estate CRM for leads, buyers, builders, and projects",
    start_url: "/",
    display: "standalone",
    background_color: "#eef4fb",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
