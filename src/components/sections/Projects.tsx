"use client";

import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { ProjectItem } from "@/types";
import { gsap } from "gsap";

export default function Projects() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const mm = gsap.matchMedia();

    // Desktop: Horizontal scrubbed pinned track (min-width: 1024px)
    mm.add("(min-width: 1024px)", () => {
      if (prefersReducedMotion || !scrollContainerRef.current || !sectionRef.current) return;

      const container = scrollContainerRef.current;
      const totalWidth = container.scrollWidth;
      const windowWidth = window.innerWidth;
      const distance = totalWidth - windowWidth + 120;

      const tween = gsap.to(container, {
        x: -distance,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          pin: true,
          scrub: 1,
          start: "top top",
          end: () => `+=${distance * 1.2}`,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        tween.kill();
      };
    });

    return () => mm.revert();
  }, []);

  // Keyboard accessibility: Close case study modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeProject) {
        setActiveProject(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProject]);

  return (
    <section
      ref={sectionRef}
      id="projects"
      aria-labelledby="projects-heading"
      className="relative hairline-b overflow-hidden bg-[var(--bg-void)]"
    >
      {/* Sticky Header Banner */}
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-20 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-3">
            <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
            [ 06 / 10 ] · SELECTED COMMISSIONS
          </div>
          <h2
            id="projects-heading"
            className="font-[family-name:var(--font-syne)] text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            Featured Digital Works.
          </h2>
        </div>

        <div className="hidden lg:flex items-center gap-3 font-mono text-xs text-[var(--accent)] tracking-widest uppercase">
          <span>SCROLL HORIZONTALLY</span>
          <span className="animate-pulse">→</span>
        </div>
      </div>

      {/* Projects Track: Horizontal on Desktop, Vertical Stack on Mobile */}
      <div
        ref={scrollContainerRef}
        className="flex flex-col lg:flex-row gap-8 lg:gap-12 px-5 sm:px-8 lg:px-12 pb-24 lg:pb-32 w-full lg:w-max"
      >
        {PORTFOLIO_DATA.projects.map((project, idx) => (
          <div
            key={project.id}
            data-cursor-text="VIEW"
            onClick={() => setActiveProject(project)}
            className="group relative w-full lg:w-[680px] shrink-0 border border-white/10 bg-[var(--bg-surface)] hover:border-[var(--accent)]/60 transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            {/* Top Bar with Number & Category */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between font-mono text-xs">
              <span className="text-[var(--accent)] font-semibold">
                [ 0{idx + 1} / 0{PORTFOLIO_DATA.projects.length} ]
              </span>
              <span className="text-[var(--text-muted)] uppercase tracking-wider">
                {project.category} · {project.year}
              </span>
            </div>

            {/* Architectural SVG Artwork Preview */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60">
              <Image
                src={project.image}
                alt={`${project.title} Preview`}
                width={1200}
                height={800}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-transparent to-transparent opacity-80" />
            </div>

            {/* Bottom Content Area */}
            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div>
                <div className="font-mono text-xs text-[var(--text-muted)] mb-1">
                  CLIENT: {project.client}
                </div>
                <h3 className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  {project.title}
                </h3>
                <p className="mt-3 text-sm text-[var(--text-secondary)] font-light leading-relaxed">
                  {project.oneLiner}
                </p>
              </div>

              {/* Stack & Metric Strip */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {project.stack.slice(0, 3).map((tech) => (
                    <span
                      key={tech}
                      className="px-2 py-0.5 border border-white/10 text-[var(--text-muted)] text-[10px]"
                    >
                      {tech}
                    </span>
                  ))}
                  {project.stack.length > 3 && (
                    <span className="px-2 py-0.5 text-[var(--text-muted)] text-[10px]">
                      +{project.stack.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[var(--accent)] font-semibold group-hover:translate-x-1 transition-transform">
                  <span>READ ARCHITECTURE</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Case Study Modal Drawer */}
      {activeProject && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-[120] flex items-center justify-end bg-black/80 backdrop-blur-md transition-all duration-300"
          onClick={() => setActiveProject(null)}
        >
          <div
            className="w-full max-w-2xl h-full bg-[var(--bg-void)] border-l border-white/15 p-6 sm:p-10 overflow-y-auto flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                <div className="font-mono text-xs text-[var(--accent)]">
                  [ CASE STUDY SPECIFICATION · {activeProject.year} ]
                </div>
                <button
                  onClick={() => setActiveProject(null)}
                  aria-label="Close Case Study"
                  className="px-3 py-1.5 border border-white/20 font-mono text-xs text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  [ CLOSE ✕ ]
                </button>
              </div>

              {/* Title & One-Liner */}
              <div>
                <h3
                  id="modal-title"
                  className="font-[family-name:var(--font-syne)] text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]"
                >
                  {activeProject.title}
                </h3>
                <div className="mt-2 font-mono text-xs text-[var(--text-muted)]">
                  CLIENT: {activeProject.client} · ROLE: {activeProject.role}
                </div>
              </div>

              {/* Full Description */}
              <p className="text-base text-[var(--text-secondary)] font-light leading-relaxed">
                {activeProject.description}
              </p>

              {/* Key Technical Highlights */}
              <div className="space-y-3">
                <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider">
                  TECHNICAL DELIVERABLES &amp; INNOVATIONS
                </div>
                <ul className="space-y-2.5 font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
                  {activeProject.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-[var(--accent)] font-bold">↳</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Benchmark Result */}
              <div className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4 font-mono text-xs text-[var(--text-primary)]">
                <span className="text-[var(--accent)] font-semibold block mb-1">
                  MEASURED IMPACT:
                </span>
                {activeProject.metrics}
              </div>

              {/* Full Tech Stack */}
              <div>
                <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider mb-2">
                  FULL SYSTEM STACK
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeProject.stack.map((s) => (
                    <span
                      key={s}
                      className="font-mono text-xs px-3 py-1 border border-white/10 text-[var(--text-secondary)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* External Links */}
            <div className="pt-8 border-t border-white/10 flex flex-wrap gap-4 font-mono text-xs">
              <a
                href={activeProject.link}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 bg-[var(--accent)] text-white font-semibold uppercase tracking-wider hover:bg-white hover:text-black transition-colors"
              >
                LIVE PRODUCTION SITE ↗
              </a>
              {activeProject.github && (
                <a
                  href={activeProject.github}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 border border-white/20 text-[var(--text-primary)] uppercase tracking-wider hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  SOURCE ARCHITECTURE ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
