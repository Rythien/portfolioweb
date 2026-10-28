"use client";

import React, { useRef, useEffect } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function Impact() {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        gsap.from(".metric-card", {
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
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
      id="impact"
      aria-labelledby="impact-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 05 / 10 ] · QUANTITATIVE OUTCOMES
        </span>
        <span>VERIFIED BENCHMARKS</span>
      </div>

      <div className="mb-14">
        <h2
          id="impact-heading"
          className="font-[family-name:var(--font-syne)] text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          Measurable Engineering Results.
        </h2>
      </div>

      {/* 4-Column High-Impact Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
        {PORTFOLIO_DATA.metrics.map((metric) => (
          <div
            key={metric.label}
            className="metric-card bg-[var(--bg-void)] p-8 sm:p-10 flex flex-col justify-between hover:bg-[var(--bg-surface)] transition-colors duration-300"
          >
            <div className="font-mono text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-[var(--accent)] mb-4 tabular-nums">
              {metric.number}
            </div>

            <div>
              <div className="font-[family-name:var(--font-syne)] text-lg font-bold text-[var(--text-primary)] mb-2">
                {metric.label}
              </div>
              <p className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed">
                {metric.subtext}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
