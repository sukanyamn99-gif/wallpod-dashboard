import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Koonway Dashboard",
    short_name: "Koonway",
    description: "คูนเว จำกัด — ระบบติดตามยอดขายและสุขภาพบริษัท",
    start_url: "/",
    display: "standalone",
    background_color: "#0E1320",
    theme_color: "#0E1320",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
