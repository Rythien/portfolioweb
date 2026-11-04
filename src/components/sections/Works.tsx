"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";
import ParallaxGallery from "@/components/ui/ParallaxGallery";

gsap.registerPlugin(ScrollTrigger);

export default function Works() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const projects = gsap.utils.toArray<HTMLElement>(".work-block");
      projects.forEach((proj) => {
        gsap.fromTo(
          proj,
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: proj,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="works"
      aria-label="Selected Works"
      className="py-28 sm:py-36 border-t border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-20 sm:mb-28 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
          <span>{SITE_DATA.works.sectionNum} · {SITE_DATA.works.title}</span>
          <span>INDEX ARCHIVE [03]</span>
        </div>

        {/* 3 Full-Width Project Blocks */}
        <div className="flex flex-col gap-28 sm:gap-40">
          {SITE_DATA.works.projects.map((project) => (
            <article
              key={project.id}
              className="work-block flex flex-col gap-8 sm:gap-12 group"
            >
              {/* Meta Header: Counter, Category, Year */}
              <div className="flex items-baseline justify-between border-b border-white/[0.08] pb-4 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
                <div className="flex items-center gap-4">
                  <span className="text-[#f2efe9] font-medium tabular-nums">
                    {project.counter}
                  </span>
                  <span>·</span>
                  <span>{project.category}</span>
                </div>
                <div className="tabular-nums">
                  {project.year}
                </div>
              </div>

              {/* Title & Roles Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-baseline">
                <h3 className="lg:col-span-7 font-[family-name:var(--font-display)] text-display sm:text-7xl font-light text-[#f2efe9] tracking-tight group-hover:text-white transition-colors">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cursor="Open"
                    className="hover:underline underline-offset-8 decoration-white/30"
                  >
                    {project.title}
                  </a>
                </h3>

                {/* Role List & Description */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2 font-mono text-label uppercase tracking-wider text-[#8b8e99]">
                    <span className="text-white/40">Roles:</span>
                    {project.roles.map((r, i) => (
                      <span key={r} className="text-[#f2efe9]/80">
                        {r}{i < project.roles.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>

                  <p className="font-[family-name:var(--font-sans)] text-body text-[#8b8e99] leading-relaxed [text-wrap:pretty]">
                    {project.description}
                  </p>
                </div>
              </div>

              {/* Interactive Parallax Media Gallery */}
              <div className="pt-2">
                <ParallaxGallery
                  imageSrc={project.image}
                  title={project.title}
                  category={project.category}
                  aspectRatio={project.aspectRatio}
                />
              </div>

              {/* CTA Link */}
              <div className="flex items-center justify-between pt-2 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-magnetic
                  data-cursor="Launch"
                  className="inline-flex items-center gap-3 text-[#f2efe9] hover:text-white underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors py-1"
                >
                  <span>Explore Architecture</span>
                  <span>→</span>
                </a>

                {project.repo && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-magnetic
                    className="hover:text-[#f2efe9] transition-colors"
                  >
                    Source Code ↗
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
