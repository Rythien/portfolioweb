"use client";

import { useEffect } from "react";
import { useArchiveProgress } from "@/store/useArchiveProgress";

/**
 * "Recovered from the dream": shown wherever a project appears once the
 * visitor has floated into its panel in THE ARCHIVE (saved across visits,
 * useArchiveProgress). Renders nothing otherwise, and nothing on the
 * server, so a static page never claims it.
 */
export default function RecoveredMark({
  slug,
  className = "",
}: {
  slug: string;
  className?: string;
}) {
  const recovered = useArchiveProgress((s) => s.recovered.includes(slug));
  useEffect(() => {
    useArchiveProgress.getState().hydrate();
  }, []);
  if (!recovered) return null;
  return (
    <span className={`inline-flex items-center gap-2 uppercase tracking-[0.12em] text-ink ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5 shrink-0">
        <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" />
      </svg>
      Recovered from the dream
    </span>
  );
}
