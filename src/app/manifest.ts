import type { MetadataRoute } from "next";

/** Lets members add Poly'sen to their phone's home screen and open it full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Poly'sen",
    short_name: "Poly'sen",
    description: "Le marché de prédiction entre potes.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1b2d",
    theme_color: "#0f1b2d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
