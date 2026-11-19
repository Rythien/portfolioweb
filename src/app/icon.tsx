import { renderIcon } from "@/lib/ogCard";

// Favicon plus the two sizes the web manifest asks for (/icon/32 etc.)
export function generateImageMetadata() {
  return [32, 192, 512].map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id);
  // The 32px favicon runs the mark nearly edge to edge so it reads in a tab
  return renderIcon(px, px <= 32 ? 1 : Math.round(px * 0.16));
}
