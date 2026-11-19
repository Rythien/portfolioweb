import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import { projects } from "@/content/projects";

// /resume is only a redirect to /cv and /journey an unlinked preview of a
// section (noindex), so both are left out
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/projects`, changeFrequency: "monthly", priority: 0.8 },
    ...projects.map((p) => ({
      url: `${SITE_URL}/project/${p.slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/cv`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
