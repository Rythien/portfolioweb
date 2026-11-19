/**
 * The site's canonical origin, for metadataBase, the sitemap and robots.
 *
 * NEXT_PUBLIC_SITE_URL wins (set it once the custom domain is live); on
 * Vercel, the production deployment's own domain; otherwise the intended
 * domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://searonmaharjan.com")
).replace(/\/$/, "");
