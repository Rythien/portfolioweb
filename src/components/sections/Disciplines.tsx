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
          stagger: 0.1,
          ease: "power3.out",
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
      className="py-28 sm:py-36 border-t border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-16 sm:mb-20 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
          <span>{SITE_DATA.disciplines.sectionNum} · {SITE_DATA.disciplines.title}</span>
          <span>CAPABILITIES</span>
        </div>

        {/* 6 Numbered Rows */}
        <div
          ref={rowsRef}
          className="divide-y divide-white/[0.08] border-b border-white/[0.08]"
        >
          {SITE_DATA.disciplines.items.map((item) => (
            <div
              key={item.number}
              data-cursor="Discipline"
              className="discipline-row group py-8 sm:py-10 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-baseline transition-all duration-300 hover:bg-white/[0.015] px-2 sm:px-4 -mx-2 sm:-mx-4"
            >
              {/* Number: Highlights on hover */}
              <div className="md:col-span-2 font-mono text-label uppercase tracking-widest text-[#8b8e99] group-hover:text-[#f2efe9] transition-colors tabular-nums">
                ({item.number})
              </div>

              {/* Title: Row shifts slightly horizontally */}
              <div className="md:col-span-4 font-[family-name:var(--font-display)] text-h3 sm:text-2xl font-light text-[#f2efe9] transition-transform duration-300 group-hover:translate-x-2">
                {item.title}
              </div>

              {/* One-line Description */}
              <div className="md:col-span-6 font-[family-name:var(--font-sans)] text-body text-[#8b8e99] leading-relaxed group-hover:text-[#f2efe9]/80 transition-colors [text-wrap:pretty]">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
