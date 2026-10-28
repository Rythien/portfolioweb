"use client";

import React, { useRef, useEffect } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function Skills() {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        gsap.from(".skill-col", {
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
          y: 35,
          opacity: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
        });
      }, containerRef);

      return () => ctx.revert();
    }
  }, []);

  const { grouped, areasOfExpertise } = PORTFOLIO_DATA.skills;

  return (
    <section
      ref={containerRef}
      id="skills"
      aria-labelledby="skills-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 03 / 10 ] · ARSENAL &amp; CAPABILITIES
        </span>
        <span>INDEX · 25 TOTAL COMPETENCIES</span>
      </div>

      <div className="mb-14">
        <h2
          id="skills-heading"
          className="font-[family-name:var(--font-syne)] text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          Specialized Technical Stack.
        </h2>
      </div>

      {/* Grouped Skills Columns with explicit counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-16">
        {grouped.map((group) => (
          <div
            key={group.category}
            className="skill-col border-t border-white/10 pt-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between font-mono text-xs mb-4">
                <span className="text-[var(--text-muted)] uppercase tracking-wider">
                  {group.category}
                </span>
                <span className="text-[var(--accent)] font-semibold">
                  {group.count}
                </span>
              </div>

              <ul className="space-y-2.5 font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 transition-colors duration-200 hover:text-[var(--text-primary)] hover:translate-x-1"
                  >
                    <span className="h-1 w-1 bg-white/30 rounded-full" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Areas of Expertise with Slash Separators and Hover Inversion */}
      <div className="border-t border-white/10 pt-12">
        <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-widest mb-6">
          AREAS OF EXPERTISE
        </div>

        <div className="flex flex-wrap items-center gap-y-3 font-[family-name:var(--font-syne)] text-lg sm:text-2xl lg:text-3xl font-semibold text-[var(--text-secondary)] leading-relaxed">
          {areasOfExpertise.map((area, idx) => (
            <React.Fragment key={area}>
              <span className="cursor-default hover:text-[var(--accent)] transition-colors duration-200">
                {area}
              </span>
              {idx < areasOfExpertise.length - 1 && (
                <span className="mx-4 font-mono text-sm sm:text-base font-normal text-[var(--border-strong)] select-none">
                  /
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
