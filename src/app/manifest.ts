import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VNTEND Financeiro",
    short_name: "VNTEND",
    description: "Gestao financeira - Gabriel e Endine",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1f1c",
    theme_color: "#1d5c4f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}