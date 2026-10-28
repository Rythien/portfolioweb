"use client";

import React, { useState, useRef, useEffect } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function Experience() {
  const [expandedId, setExpandedId] = useState<string | null>("exp-1");
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        gsap.from(".timeline-row", {
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

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      ref={containerRef}
      id="path"
      aria-labelledby="path-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 04 / 10 ] · CAREER TIMELINE / PATH
        </span>
        <span>2020 — 2026 ARCHIVE</span>
      </div>

      <div className="mb-14">
        <h2
          id="path-heading"
          className="font-[family-name:var(--font-syne)] text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          Engineering History &amp; Milestones.
        </h2>
      </div>

      {/* Vertical Timeline Accordion */}
      <div className="divide-y divide-white/10 border-t border-b border-white/10">
        {PORTFOLIO_DATA.experience.map((item) => {
          const isExpanded = expandedId === item.id;

          return (
            <div key={item.id} className="timeline-row group py-8 sm:py-10 transition-colors duration-300">
              <div
                onClick={() => toggleExpand(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(item.id);
                  }
                }}
                aria-expanded={isExpanded}
                className="cursor-pointer flex flex-col md:flex-row md:items-baseline justify-between gap-4 select-none"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3 font-mono text-xs text-[var(--accent)]">
                    <span>{item.period}</span>
                    <span>·</span>
                    <span className="text-[var(--text-muted)]">{item.location}</span>
                  </div>

                  <h3 className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {item.role}
                  </h3>

                  <div className="font-mono text-sm text-[var(--text-secondary)]">
                    @ {item.company}
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
                  <span>{isExpanded ? "[ COLLAPSE − ]" : "[ DETAILS + ]"}</span>
                </div>
              </div>

              {/* High-level summary */}
              <p className="mt-4 max-w-3xl text-sm sm:text-base text-[var(--text-secondary)] font-light leading-relaxed">
                {item.summary}
              </p>

              {/* Expandable Results and Stack */}
              {isExpanded && (
                <div className="mt-6 pt-6 border-t border-white/5 space-y-6 animate-fadeIn">
                  <div>
                    <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider mb-3">
                      KEY DELIVERABLES &amp; IMPACT
                    </div>
                    <ul className="space-y-3 font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                      {item.results.map((res, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-[var(--accent)] font-bold mt-0.5">↳</span>
                          <span>{res}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider mb-2">
                      CORE TECHNOLOGIES
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.stack.map((s) => (
                        <span
                          key={s}
                          className="font-mono text-[11px] px-2.5 py-1 bg-[var(--bg-surface-elevated)] border border-white/10 text-[var(--text-primary)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Education & Academic Rigor Section */}
      <div className="mt-16 pt-12 border-t border-white/10">
        <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-widest mb-6">
          ACADEMIC RIGOR &amp; INDEPENDENT RESEARCH
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {PORTFOLIO_DATA.education.map((edu) => (
            <div
              key={edu.institution}
              className="border border-white/10 p-6 bg-[var(--bg-surface)] flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="font-mono text-xs text-[var(--accent)] mb-1">
                  {edu.period} · {edu.location}
                </div>
                <h4 className="font-[family-name:var(--font-syne)] text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                  {edu.degree}
                </h4>
                <div className="font-mono text-xs text-[var(--text-muted)] mt-1">
                  {edu.institution}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-light">
                {edu.details}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
