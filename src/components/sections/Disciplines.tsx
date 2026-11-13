"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";

gsap.registerPlugin(ScrollTrigger);

export default function Disciplines() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".discipline-row",
        { opacity: 0, y: 25 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.06,
          ease: "expo.out",
          scrollTrigger: {
            trigger: rowsRef.current,
            start: "top 80%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="disciplines"
      aria-label="Disciplines and Expertise"
      className="scroll-mt-24 py-16 sm:py-24 lg:py-32 border-t border-rule"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div
          ref={rowsRef}
          className="divide-y divide-rule border-b border-rule"
        >
          {SITE_DATA.disciplines.items.map((item) => (
            <div
              key={item.number}
              data-cursor="Discipline"
              className="discipline-row group py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-baseline transition-all duration-300 hover:bg-ink/[0.03] px-2 sm:px-4 -mx-2 sm:-mx-4"
            >
              <div className="md:col-span-2 font-mono text-label uppercase tracking-widest text-ink-muted group-hover:text-ink transition-colors tabular-nums">
                ({item.number})
              </div>

              <div className="md:col-span-4 font-[family-name:var(--font-sans)] text-h2 uppercase text-ink/90 group-hover:text-ink transition-all duration-300 group-hover:translate-x-2">
                {item.title}
              </div>

              <div className="md:col-span-6 font-[family-name:var(--font-sans)] text-body text-ink/70 leading-relaxed group-hover:text-ink/80 transition-colors [text-wrap:pretty]">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
