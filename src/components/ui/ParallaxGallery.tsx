"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
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
  const imageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !containerRef.current || !imageRef.current) return;

    const ctx = gsap.context(() => {
      // Gentle parallax translation linked to scroll
      gsap.fromTo(
        imageRef.current,
        { yPercent: -8, scale: 1.05 },
        {
          yPercent: 8,
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
      className={`relative w-full ${aspectRatio} overflow-hidden bg-[#111216] border border-white/[0.08] group`}
    >
      {/* Parallax Image Inner */}
      <div
        ref={imageRef}
        className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      >
        <Image
          src={imageSrc}
          alt={`${title} — ${category}`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
          className="object-cover filter contrast-[1.05] brightness-[0.92] group-hover:brightness-100 transition-all duration-500"
          priority={false}
        />
      </div>

      {/* Subtle overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#08080a]/60 via-transparent to-transparent pointer-events-none" />

      {/* Corner Frame Stamp */}
      <div className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-widest text-white/60 bg-[#08080a]/80 backdrop-blur-sm px-2.5 py-1 border border-white/10 pointer-events-none">
        ARCHIVE REF // {title}
      </div>
    </div>
  );
}
