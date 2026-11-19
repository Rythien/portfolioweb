import type { MetadataRoute } from "next";
import { SITE_DATA } from "@/content/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_DATA.brand.name}: ${SITE_DATA.brand.role}`,
    short_name: SITE_DATA.brand.name,
    description: SITE_DATA.brand.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#E9E7E2",
    theme_color: "#E9E7E2",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
