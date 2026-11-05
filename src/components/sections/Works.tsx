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
      className="scroll-mt-24 py-28 sm:py-36 border-t border-rule"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="flex items-center justify-between border-b border-rule pb-4 mb-20 sm:mb-28 font-mono text-label uppercase tracking-widest text-ink-muted">
          <span>{SITE_DATA.works.sectionNum} · {SITE_DATA.works.title}</span>
          <span className="tabular-nums">{String(SITE_DATA.works.projects.length).padStart(2, "0")} Projects</span>
        </div>

        <div className="flex flex-col gap-28 sm:gap-40">
          {SITE_DATA.works.projects.map((project) => (
            <article
              key={project.id}
              className="work-block flex flex-col gap-8 sm:gap-12 group"
            >
              <div className="flex items-baseline justify-between border-b border-rule pb-4 font-mono text-label uppercase tracking-widest text-ink-muted">
                <div className="flex items-center gap-4">
                  <span className="text-ink font-medium tabular-nums">
                    {project.counter}
                  </span>
                  <span>·</span>
                  <span>{project.category}</span>
                </div>
                <div className="tabular-nums">
                  {project.year}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-baseline">
                <h3 className="lg:col-span-7 font-[family-name:var(--font-display)] text-display sm:text-7xl font-light text-ink tracking-tight group-hover:text-ink transition-colors">
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cursor="Open"
                    className="hover:underline underline-offset-8 decoration-ink/30"
                  >
                    {project.title}
                  </a>
                </h3>

                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2 font-mono text-label uppercase tracking-wider text-ink-muted">
                    <span className="text-ink/40">Roles:</span>
                    {project.roles.map((r, i) => (
                      <span key={r} className="text-ink/80">
                        {r}{i < project.roles.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>

                  <p className="font-[family-name:var(--font-sans)] text-body text-ink-muted leading-relaxed [text-wrap:pretty]">
                    {project.description}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <ParallaxGallery
                  imageSrc={project.image}
                  title={project.title}
                  category={project.category}
                  aspectRatio={project.aspectRatio}
                />
              </div>

              <div className="flex items-center justify-between pt-2 font-mono text-label uppercase tracking-widest text-ink-muted">
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-magnetic
                  data-cursor="Launch"
                  className="inline-flex items-center gap-3 text-ink hover:text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink transition-colors py-1"
                >
                  <span>View Project</span>
                  <span>→</span>
                </a>

                {project.repo && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-magnetic
                    className="hover:text-ink transition-colors"
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
