import Image from "next/image";
import type { ProjectImage } from "@/content/projects";

interface ProjectArtProps {
  image: ProjectImage;
  /** Rendered width at each breakpoint, so the srcset stays small. */
  sizes: string;
  /** The page's LCP image (case-study hero): eager + fetchpriority=high. */
  lcp?: boolean;
  /** "eager" for the first Works panel; everything else stays lazy. */
  loading?: "lazy" | "eager";
  className?: string;
}

/**
 * A 16:10 artwork frame: the WAKE image with its DREAM variant stacked
 * on top at opacity var(--dream), so it crossfades with the flood itself
 * rather than snapping when the mode flips.
 */
export default function ProjectArt({
  image,
  sizes,
  lcp = false,
  loading,
  className = "",
}: ProjectArtProps) {
  return (
    <div className={`relative w-full aspect-[16/10] overflow-hidden bg-surface-elevated ${className}`}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        loading={lcp ? "eager" : loading}
        fetchPriority={lcp ? "high" : undefined}
        className="object-cover"
      />
      {image.dreamSrc && (
        <Image
          src={image.dreamSrc}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className="object-cover project-art-dream"
        />
      )}
    </div>
  );
}
