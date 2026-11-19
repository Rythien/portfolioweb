import type { Metadata } from "next";
import { SITE_DATA } from "@/content/site";

const SITE_NAME = SITE_DATA.brand.name;

/**
 * Metadata for one route: its own title, description and canonical URL,
 * repeated into the Open Graph and Twitter cards (a route's openGraph
 * object replaces its parent's wholesale, so each one is complete). The
 * card image comes from the route's opengraph-image file.
 */
export function pageMeta({
  title,
  description,
  path,
  type = "website",
}: {
  /** Without the site name: the root layout's template adds it. */
  title: string;
  description: string;
  /** Route path, e.g. "/projects". */
  path: string;
  type?: "website" | "article";
}): Metadata {
  const full = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "en_US",
      url: path,
      siteName: SITE_NAME,
      title: full,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: full,
      description,
    },
  };
}
