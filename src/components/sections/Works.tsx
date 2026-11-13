"use client";

import React, { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { projects, type Project } from "@/content/projects";
import ProjectGallery from "@/components/ui/ProjectGallery";
import WorkChip from "@/components/ui/WorkChip";
import { useThemeStore } from "@/store/useThemeStore";

gsap.registerPlugin(ScrollTrigger);

const MAX_TILT = 6; // degrees

function TitleWithAccent({ project }: { project: Project }) {
  const { title, titleAccent } = project;
  if (!titleAccent) return <>{title}</>;
  const idx = title.indexOf(titleAccent);
  if (idx === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, idx)}
      <span className="accent-word">{titleAccent}</span>
      {title.slice(idx + titleAccent.length)}
    </>
  );
}

export default function Works() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reducedRef = useRef(false);
  const mode = useThemeStore((s) => s.mode);
  const isDream = mode === "dream";

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    reducedRef.current = prefersReducedMotion;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Panels slide in from the right as you scroll
      gsap.utils.toArray<HTMLElement>(".work-panel-wrap").forEach((panel) => {
        gsap.fromTo(
          panel,
          { x: 120, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: {
              trigger: panel,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Text blocks keep the quieter entrance
      gsap.utils.toArray<HTMLElement>(".work-head").forEach((head) => {
        gsap.fromTo(
          head,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: {
              trigger: head,
              start: "top 80%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Hover tilt, max 6deg, transforms only
  const handleTiltMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (reducedRef.current || e.pointerType !== "mouse") return;
    const wrap = e.currentTarget;
    const inner = wrap.querySelector<HTMLElement>(".work-panel-tilt");
    if (!inner) return;
    const rect = wrap.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(inner, {
      rotateY: nx * MAX_TILT * 2,
      rotateX: -ny * MAX_TILT * 2,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, []);

  const handleTiltLeave = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const inner = e.currentTarget.querySelector<HTMLElement>(".work-panel-tilt");
    if (!inner) return;
    gsap.to(inner, {
      rotateX: 0,
      rotateY: 0,
      duration: 0.6,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, []);

  return (
    <section
      ref={sectionRef}
      id="works"
      aria-label="Selected Works"
      className="scroll-mt-24 py-16 sm:py-24 lg:py-32 border-t border-rule"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="flex flex-col gap-24 sm:gap-32">
          {projects.map((project) => (
            <article key={project.slug} className="flex flex-col gap-8 sm:gap-12">
              <div className="work-head flex flex-col gap-8 sm:gap-12">
                <div className="flex items-baseline justify-between border-b border-rule pb-4 font-mono text-label text-ink/80">
                  <div className="flex items-center gap-4">
                    <span className="text-ink font-medium tabular-nums">
                      {project.counter}
                    </span>
                    <span>{project.category}</span>
                  </div>
                  <div className="tabular-nums">{project.year}</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-baseline">
                  <h3 className="lg:col-span-7 font-[family-name:var(--font-sans)] text-h1 uppercase text-ink">
                    <Link
                      href={`/project/${project.slug}`}
                      data-cursor="Open"
                      className="hover:underline underline-offset-8 decoration-ink/30"
                    >
                      <TitleWithAccent project={project} />
                    </Link>
                  </h3>

                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2 font-mono text-label text-ink/80">
                      <span>Roles:</span>
                      {project.roles.map((r, i) => (
                        <span key={r}>
                          {r}
                          {i < project.roles.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>

                    <p
                      className={`font-[family-name:var(--font-sans)] text-body leading-relaxed max-w-[60ch] [text-wrap:pretty] ${
                        isDream ? "text-ink/70 italic" : "text-ink/70"
                      }`}
                    >
                      {isDream && project.dreamDescription
                        ? project.dreamDescription
                        : project.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Panel: slides in from the right, tilts on hover, chip
                  refracts it, click opens the case study */}
              <div
                className="work-panel-wrap relative"
                onPointerMove={handleTiltMove}
                onPointerLeave={handleTiltLeave}
              >
                <div className="work-panel-tilt relative will-change-transform">
                  <ProjectGallery
                    images={project.images}
                    title={project.title}
                    category={project.category}
                    aspectRatio={project.aspectRatio}
                  />
                  <Link
                    href={`/project/${project.slug}`}
                    aria-label={`Open ${project.title} case study`}
                    data-cursor="Open"
                    className="absolute inset-0 z-10"
                  />
                </div>
                <WorkChip project={project} />
              </div>

              <div className="flex items-center justify-between font-mono text-label text-ink/80">
                <Link
                  href={`/project/${project.slug}`}
                  data-magnetic
                  className="inline-flex items-center gap-3 text-ink underline underline-offset-4 decoration-ink/40 hover:decoration-ink transition-colors py-1"
                >
                  <span>Case Study</span>
                  <span>→</span>
                </Link>

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
