import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and linked from <head> by Next itself.
// Colours are the dark --background; the splash screen shows before the page
// can know which scheme the phone is in, and dark is what the app defaults to.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Training program",
    short_name: "Training",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1b1c22",
    theme_color: "#1b1c22",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
