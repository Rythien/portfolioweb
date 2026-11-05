"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ProjectImage } from "@/content/projects";
import { useThemeStore } from "@/store/useThemeStore";

gsap.registerPlugin(ScrollTrigger);

interface ProjectGalleryProps {
  images: ProjectImage[];
  title: string;
  category: string;
  aspectRatio?: string;
}

export default function ProjectGallery({
  images,
  title,
  category,
  aspectRatio = "aspect-[16/10]",
}: ProjectGalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const mode = useThemeStore((s) => s.mode);
  const hasMultiple = images.length > 1;

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const retreat = useCallback(() => {
    setActive((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !containerRef.current || !innerRef.current)
      return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        innerRef.current,
        { yPercent: -4, scale: 1.02 },
        {
          yPercent: 4,
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const current = images[active];
  const isPlaceholder = !current || !current.src || current.src === "/opengraph-image";
  const isDream = mode === "dream";

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className={`relative w-full ${aspectRatio} overflow-hidden border border-rule group ${isDream ? "shadow-[0_0_40px_rgba(99,102,241,0.08)]" : ""}`}
        style={{ backgroundColor: "var(--t-surface-el)" }}
      >
        <div
          ref={innerRef}
          className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] transition-transform duration-700 ease-out group-hover:scale-[1.01]"
        >
          {isPlaceholder ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
              <span className="font-mono text-label uppercase tracking-widest text-ink-faint">
                {category}
              </span>
              <span className="font-[family-name:var(--font-display)] text-h2 font-light text-ink/20">
                {title}
              </span>
              <span className="font-mono text-label uppercase tracking-widest text-ink-faint">
                Media pending
              </span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={current.src}
              alt={current.alt}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-surface/40 via-transparent to-transparent pointer-events-none" />

        <div className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-widest text-ink-muted bg-surface/80 backdrop-blur-sm px-2.5 py-1 border border-rule pointer-events-none">
          {title}
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={retreat}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-surface/70 backdrop-blur-sm border border-rule text-ink-muted hover:text-ink transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <span aria-hidden="true">&lsaquo;</span>
            </button>
            <button
              type="button"
              onClick={advance}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-surface/70 backdrop-blur-sm border border-rule text-ink-muted hover:text-ink transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <span aria-hidden="true">&rsaquo;</span>
            </button>
          </>
        )}

        {hasMultiple && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === active
                    ? "bg-ink w-4"
                    : "bg-ink/30 hover:bg-ink/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {current?.caption && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-faint px-1">
          {current.caption}
          {hasMultiple && (
            <span className="ml-2 text-ink-faint/60">
              {active + 1} / {images.length}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
