"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ParallaxGalleryProps {
  imageSrc: string;
  title: string;
  category: string;
  aspectRatio?: string;
}

export default function ParallaxGallery({
  imageSrc,
  title,
  category,
  aspectRatio = "aspect-[16/10]",
}: ParallaxGalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const isPlaceholder = !imageSrc || imageSrc === "/opengraph-image";

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !containerRef.current || !innerRef.current) return;

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

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${aspectRatio} overflow-hidden bg-surface-elevated border border-rule group`}
    >
      <div
        ref={innerRef}
        className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] transition-transform duration-700 ease-out group-hover:scale-[1.01]"
      >
        {isPlaceholder ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-surface-elevated">
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
            src={imageSrc}
            alt={`${title} — ${category}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-surface/40 via-transparent to-transparent pointer-events-none" />

      <div className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-widest text-ink-muted bg-surface/80 backdrop-blur-sm px-2.5 py-1 border border-rule pointer-events-none">
        {title}
      </div>
    </div>
  );
}
