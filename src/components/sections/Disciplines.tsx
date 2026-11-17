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
      className="scroll-mt-[108px] lg:scroll-mt-20 pt-32 section-end border-t border-rule"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div
          ref={rowsRef}
          className="divide-y divide-rule border-b border-rule"
        >
          {/* Heading and description sit in their own columns with a real
              gutter; cols 11-12 stay empty at lg for the parked crystal.
              Grid rows size to the taller of the two cells. Each row clears
              the header (80px, plus the 28px strip below lg) when linked. */}
          {SITE_DATA.disciplines.items.map((item) => (
            <div
              key={item.number}
              id={`discipline-${item.number}`}
              data-cursor="Discipline"
              className="discipline-row group scroll-mt-[108px] lg:scroll-mt-20 py-10 sm:py-12 grid grid-cols-1 md:grid-cols-12 gap-y-5 md:gap-x-8 lg:gap-x-12 items-start transition-colors duration-300 hover:bg-ink/[0.03] px-2 sm:px-4 -mx-2 sm:-mx-4"
            >
              <div data-crystal-avoid className="discipline-head md:col-span-7 lg:col-span-6 flex flex-col gap-4 min-w-0">
                <div className="font-mono text-label uppercase tracking-widest text-ink-muted group-hover:text-ink transition-colors tabular-nums">
                  ({item.number})
                </div>
                <div className="discipline-title font-[family-name:var(--font-sans)] text-h2 uppercase text-ink/90 group-hover:text-ink transition-all duration-300 group-hover:translate-x-2">
                  {item.title}
                </div>
              </div>

              <p data-crystal-avoid className="md:col-span-5 lg:col-span-4 md:pt-9 font-[family-name:var(--font-sans)] text-body text-ink/70 leading-relaxed group-hover:text-ink/80 transition-colors [text-wrap:pretty]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
