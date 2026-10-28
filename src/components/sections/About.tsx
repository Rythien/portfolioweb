"use client";

import React, { useRef, useEffect } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";

export default function About() {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        gsap.from(".about-fade", {
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
          y: 35,
          opacity: 0,
          duration: 0.85,
          stagger: 0.12,
          ease: "power3.out",
        });
      }, containerRef);

      return () => ctx.revert();
    }
  }, []);

  return (
    <section
      ref={containerRef}
      id="about"
      aria-labelledby="about-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      {/* Section Subheader */}
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 01 / 10 ] · MANIFESTO &amp; PHILOSOPHY
        </span>
        <span className="hidden sm:inline">27.7172° N · 85.3240° E</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Left Column: Bio & Origin Story */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
          <div>
            <h2
              id="about-heading"
              className="about-fade font-[family-name:var(--font-syne)] text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--text-primary)] leading-[1.1] mb-6"
            >
              Crafting digital spaces with physical permanence.
            </h2>

            <div className="space-y-4 text-base sm:text-lg text-[var(--text-secondary)] font-light leading-relaxed">
              <p className="about-fade">{PORTFOLIO_DATA.personal.bio}</p>
              <p className="about-fade text-sm sm:text-base border-l-2 border-[var(--accent)] pl-4 text-[var(--text-muted)] italic">
                &ldquo;{PORTFOLIO_DATA.personal.originStory}&rdquo;
              </p>
            </div>
          </div>

          {/* Newari Heritage Coordinates Card */}
          <div className="about-fade border border-white/10 p-5 bg-[var(--bg-surface)] font-mono text-xs space-y-2">
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>ROOTS: KATHMANDU VALLEY</span>
              <span className="text-[var(--accent)]">NEWARI HERITAGE</span>
            </div>
            <div className="text-[var(--text-primary)] font-medium">
              Spatial Geometry · Wood &amp; Stone Carving Traditions · Algorithmic Craft
            </div>
          </div>
        </div>

        {/* Right Column: Three Numbered Focus Areas (#01, #02, #03) */}
        <div className="lg:col-span-7 flex flex-col divide-y divide-white/10 border-t border-b border-white/10 lg:border-t-0">
          {PORTFOLIO_DATA.focusAreas.map((area) => (
            <div
              key={area.number}
              className="about-fade group py-8 sm:py-10 transition-colors duration-300 hover:bg-white/[0.02]"
            >
              <div className="flex items-baseline justify-between mb-3">
                <span className="font-mono text-sm sm:text-base font-semibold text-[var(--accent)]">
                  {area.number}
                </span>
                <span className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider">
                  {area.tagline}
                </span>
              </div>

              <h3 className="font-[family-name:var(--font-syne)] text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-3 group-hover:text-[var(--accent)] transition-colors">
                {area.title}
              </h3>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed mb-6 font-light">
                {area.description}
              </p>

              <div className="flex flex-wrap gap-2">
                {area.tech.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] px-2.5 py-1 border border-white/10 text-[var(--text-muted)] group-hover:border-white/20 group-hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
