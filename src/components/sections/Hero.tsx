"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SITE_DATA } from "@/content/site";

export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);
  const line1Ref = useRef<HTMLDivElement | null>(null);
  const line2Ref = useRef<HTMLDivElement | null>(null);
  const metaRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      if (line1Ref.current) line1Ref.current.style.transform = "none";
      if (line2Ref.current) line2Ref.current.style.transform = "none";
      if (metaRef.current) metaRef.current.style.opacity = "1";
      if (footerRef.current) footerRef.current.style.opacity = "1";
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 });

      tl.fromTo(
        [line1Ref.current, line2Ref.current],
        { yPercent: 115, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.1,
          stagger: 0.16,
          ease: "power3.out",
        }
      ).fromTo(
        [metaRef.current, footerRef.current],
        { opacity: 0, y: 15 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power2.out",
        },
        "-=0.4"
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      id="top"
      aria-label="Hero Introduction"
      className="relative min-h-screen flex flex-col justify-between pt-28 pb-20 sm:pb-24 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto w-full overflow-hidden select-none"
    >
      {/* Top Metadata */}
      <div className="relative z-10 flex items-center justify-between font-mono text-label uppercase tracking-widest text-ink-muted pt-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-ink" />
          <span>{SITE_DATA.brand.role}</span>
        </div>
        <div className="tabular-nums hidden sm:block">
          {SITE_DATA.brand.coordinates}
        </div>
      </div>

      {/* Headline */}
      <div className="relative z-10 my-auto py-12 max-w-5xl">
        <h1 className="font-[family-name:var(--font-display)] text-display font-light text-ink leading-[1.04] tracking-[-0.035em]">
          <div className="overflow-hidden py-[0.08em] -my-[0.08em]">
            <div ref={line1Ref}>
              {SITE_DATA.hero.headlineLine1}
            </div>
          </div>
          <div className="overflow-hidden mt-2 sm:mt-4 py-[0.08em] -my-[0.08em]">
            <div ref={line2Ref} className="italic text-ink-muted">
              {SITE_DATA.hero.headlineLine2}
            </div>
          </div>
        </h1>

        {/* Discipline Tags */}
        <div
          ref={metaRef}
          className="mt-8 sm:mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-label uppercase tracking-widest text-ink-muted"
        >
          {SITE_DATA.hero.disciplines.map((item, idx) => (
            <React.Fragment key={item}>
              <span className="text-ink/90 hover:text-ink transition-colors">
                {item}
              </span>
              {idx < SITE_DATA.hero.disciplines.length - 1 && (
                <span className="text-ink/20">·</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div
        ref={footerRef}
        className="relative z-10 flex items-center justify-between border-t border-rule pt-6 font-mono text-label uppercase tracking-widest text-ink-muted"
      >
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">{SITE_DATA.hero.hint}</span>
          <span className="sm:hidden">{SITE_DATA.hero.hintTouch}</span>
          <span className="animate-bounce">↓</span>
        </div>

        <div>
          <a
            href={SITE_DATA.hero.socialUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-magnetic
            className="hover:text-ink underline underline-offset-4 decoration-ink/20 transition-colors"
          >
            {SITE_DATA.hero.socialLabel} ↗
          </a>
        </div>
      </div>
    </section>
  );
}
