import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { renderCard, CARD_SIZE } from "@/lib/ogCard";
import { projects, getProjectBySlug } from "@/content/projects";

export const size = CARD_SIZE;
export const contentType = "image/png";
export const alt = "Case study card";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

/** The cover crop as a data URI. og-cover.jpg is the WAKE cover cropped to
 * 1200x630 (npm run gen:og; the card renderer cannot read WebP). Cached
 * (Cache Components), so with generateStaticParams the cards are drawn at
 * build, not per request. */
async function coverDataUri(slug: string) {
  "use cache";
  const jpg = await readFile(join(process.cwd(), "public", "projects", slug, "og-cover.jpg"));
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return renderCard({ kicker: "Case study", title: "Not found", subtitle: "" });
  const index = projects.findIndex((p) => p.slug === slug);
  return renderCard({
    kicker: `Case study // ${String(index + 1).padStart(2, "0")} · ${project.year}`,
    title: project.title,
    subtitle: project.subtitle ?? project.summary ?? "",
    image: await coverDataUri(slug),
  });
}
