"use client";

import React, { useRef, useEffect } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";

export default function Journey() {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        gsap.from(".journey-block", {
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
          y: 40,
          opacity: 0,
          duration: 0.9,
          stagger: 0.2,
          ease: "power3.out",
        });

        gsap.from(".journey-line", {
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
          },
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.2,
          ease: "expo.out",
        });
      }, containerRef);

      return () => ctx.revert();
    }
  }, []);

  const { from, to } = PORTFOLIO_DATA.journey;

  return (
    <section
      ref={containerRef}
      id="journey"
      aria-labelledby="journey-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 02 / 10 ] · SPATIAL TRAJECTORY
        </span>
        <span>ORIGIN → CONTEMPORARY HORIZON</span>
      </div>

      <div className="mb-12">
        <h2
          id="journey-heading"
          className="journey-block font-[family-name:var(--font-syne)] text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          From Newari Brick &amp; Timber → To Algorithmic Light.
        </h2>
      </div>

      {/* From → Now Architecture Grid */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 pt-8">
        {/* Origin: Patan / Kathmandu */}
        <div className="journey-block border border-white/10 p-6 sm:p-8 bg-[var(--bg-surface)] flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-[var(--accent)] font-semibold">FROM · ORIGIN</span>
              <span className="text-[var(--text-muted)]">{from.era}</span>
            </div>
            <h3 className="font-[family-name:var(--font-syne)] text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              {from.location}
            </h3>
            <div className="font-mono text-xs text-[var(--text-secondary)]">
              [ {from.coords} ]
            </div>
          </div>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] font-light leading-relaxed">
            {from.description}
          </p>

          <div className="pt-4 border-t border-white/10 flex items-center gap-2 font-mono text-[11px] text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full border border-[var(--accent)] flex items-center justify-center">
              <span className="h-1 w-1 bg-[var(--accent)] rounded-full" />
            </span>
            <span>DISCIPLINE: TACTILE GEOMETRY &amp; HARMONY</span>
          </div>
        </div>

        {/* Connecting Vector Line (Desktop) */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center pointer-events-none">
          <div className="journey-line h-[1px] w-24 bg-gradient-to-r from-[var(--accent)] to-white/40" />
          <div className="px-2 font-mono text-[10px] text-[var(--accent)] bg-[var(--bg-void)] border border-white/10">
            TRANSLATION
          </div>
          <div className="journey-line h-[1px] w-24 bg-gradient-to-r from-white/40 to-[var(--accent)]" />
        </div>

        {/* Now: Global Digital Frontier */}
        <div className="journey-block border border-white/10 p-6 sm:p-8 bg-[var(--bg-surface)] flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-[var(--accent)] font-semibold">TO · CONTEMPORARY</span>
              <span className="text-[var(--text-muted)]">{to.era}</span>
            </div>
            <h3 className="font-[family-name:var(--font-syne)] text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              {to.location}
            </h3>
            <div className="font-mono text-xs text-[var(--text-secondary)]">
              [ {to.coords} ]
            </div>
          </div>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] font-light leading-relaxed">
            {to.description}
          </p>

          <div className="pt-4 border-t border-white/10 flex items-center gap-2 font-mono text-[11px] text-[var(--text-muted)]">
            <span className="h-2 w-2 rounded-full border border-white/40 flex items-center justify-center">
              <span className="h-1 w-1 bg-white rounded-full animate-ping" />
            </span>
            <span>STATUS: ACTIVE ACROSS GLOBAL TIMEZONES</span>
          </div>
        </div>
      </div>
    </section>
  );
}
