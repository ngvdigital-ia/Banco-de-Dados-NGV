import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NGV Digital",
    short_name: "NGV Digital",
    id: "/dashboard",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#1048E6",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      {
        src: "/icons/ngv-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/ngv-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/ngv-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
