"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import KineticHeading from "@/components/ui/Kinetic";
import PixelImage from "@/components/ui/PixelImage";
import { projects } from "@/content/projects";

gsap.registerPlugin(ScrollTrigger);

export default function Projects() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const mm = gsap.matchMedia();

    // Desktop horizontal pinning
    mm.add("(min-width: 1024px)", () => {
      const getScrollAmount = () => Math.max(0, track.scrollWidth - window.innerWidth);

      const tween = gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: "none",
      });

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${getScrollAmount()}`,
        pin: true,
        animation: tween,
        scrub: 0.5,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
      });

      // Refresh when fonts and images finish loading
      if (typeof document !== "undefined" && document.fonts) {
        document.fonts.ready.then(() => {
          ScrollTrigger.refresh();
        });
      }

      return () => {
        trigger.kill();
        tween.kill();
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="projects"
      aria-label="Selected works and case studies"
      className="py-24 lg:py-0 border-b border-white/[0.08] bg-[#050505] overflow-hidden lg:h-screen lg:flex lg:flex-col lg:justify-between"
    >
      {/* Top Header */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full pt-0 lg:pt-12 mb-8 lg:mb-0">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
              #08 · SELECTED WORK
            </span>
            <span className="hidden sm:inline font-mono text-label uppercase text-[#edebe6]/75">
              Scroll → to browse
            </span>
          </div>
          <Link
            href="/projects"
            data-magnetic
            data-cursor="Index"
            className="font-mono text-label uppercase tracking-widest text-[#edebe6] hover:underline underline-offset-4"
          >
            All Projects · {projects.length.toString().padStart(2, "0")} →
          </Link>
        </div>
      </div>

      {/* Horizontal Track (Desktop) / Vertical Stack (Mobile) */}
      <div className="my-auto overflow-visible">
        <div
          ref={trackRef}
          className="flex flex-col lg:flex-row gap-12 lg:gap-16 px-6 sm:px-10 lg:px-16 w-full lg:w-max items-center"
        >
          {/* Intro Panel on Desktop */}
          <div className="w-full lg:w-[380px] shrink-0 mb-4 lg:mb-0">
            <KineticHeading
              as="h2"
              className="text-h1 font-light text-[#edebe6]"
            >
              Selected works.
            </KineticHeading>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed max-w-[65ch] [text-wrap:pretty]">
              Case studies in website design, mobile apps, and 3D modeling.
            </p>
          </div>

          {/* Project Panels */}
          {projects.map((project, idx) => (
            <article
              key={project.slug}
              className="w-full lg:w-[620px] shrink-0 border border-white/[0.1] bg-white/[0.015] p-6 sm:p-8 rounded-sm hover:border-white/30 transition-colors group flex flex-col justify-between"
            >
              {/* Thumbnail with 2-Tone Bayer Dither and Hover Peek */}
              <Link
                href={`/project/${project.slug}`}
                data-cursor="Open"
                className="block mb-6 overflow-hidden"
              >
                <PixelImage
                  src={project.images[0]?.src || ""}
                  alt={project.title}
                  caption={project.subtitle}
                  aspectRatio="aspect-[16/10]"
                />
              </Link>

              {/* Project Meta and Title */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between font-mono text-label uppercase tracking-wider text-[#edebe6]/75 tabular-nums">
                  <span>
                    0{idx + 1} · {project.type}
                  </span>
                  <span>{project.year}</span>
                </div>

                <h3 className="font-[family-name:var(--font-display)] text-h3 font-light text-[#edebe6] group-hover:text-white transition-colors">
                  <Link href={`/project/${project.slug}`} data-cursor="Open">
                    {project.title}
                  </Link>
                </h3>

                <p className="font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed line-clamp-2 [text-wrap:pretty]">
                  {project.summary}
                </p>

                <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between font-mono text-label uppercase tracking-widest text-[#edebe6]/80">
                  <Link
                    href={`/project/${project.slug}`}
                    data-magnetic
                    className="inline-flex items-center gap-2 hover:underline underline-offset-4"
                  >
                    <span>Read case study</span>
                    <span>→</span>
                  </Link>
                  {project.placeholder && (
                    <span className="text-label text-[#edebe6]/60">
                      [PLACEHOLDER]
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Bottom Progress Bar on Desktop */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full pb-0 lg:pb-8 hidden lg:block">
        <div className="flex items-center justify-between font-mono text-label uppercase tracking-widest text-[#edebe6]/75 border-t border-white/[0.08] pt-4">
          <span />
          <Link href="/projects" className="hover:text-white">
            VIEW ALL {projects.length} CASE STUDIES →
          </Link>
        </div>
      </div>
    </section>
  );
}
