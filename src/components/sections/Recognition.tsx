"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";
import Counter from "@/components/ui/Counter";

gsap.registerPlugin(ScrollTrigger);

export default function Recognition() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".recognition-row",
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          stagger: 0.08,
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
      id="recognition"
      aria-label="Awards and Recognition"
      className="py-28 sm:py-36 border-t border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-16 sm:mb-24 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
          <span>{SITE_DATA.recognition.sectionNum} · {SITE_DATA.recognition.title}</span>
          <span>ACCOLADES & MILESTONES</span>
        </div>

        {/* Counter Number Block */}
        <div className="mb-16 sm:mb-24 flex flex-col sm:flex-row items-baseline gap-6 sm:gap-12">
          <div className="font-mono text-display sm:text-8xl font-light text-[#f2efe9] tabular-nums tracking-tighter">
            <Counter value={parseInt(SITE_DATA.recognition.totalAccolades, 10)} padDigits={2} />
          </div>
          <div className="font-mono text-label uppercase tracking-widest text-[#8b8e99] max-w-xs">
            {SITE_DATA.recognition.accoladesLabel}
          </div>
        </div>

        {/* Recognition List Grouped by Year and Project */}
        <div
          ref={rowsRef}
          className="divide-y divide-white/[0.08] border-b border-white/[0.08]"
        >
          {SITE_DATA.recognition.items.map((item, idx) => (
            <div
              key={idx}
              data-cursor="Honors"
              className="recognition-row group py-6 sm:py-8 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-baseline transition-all duration-300 hover:bg-white/[0.015] px-2 sm:px-4 -mx-2 sm:-mx-4"
            >
              {/* Year */}
              <div className="md:col-span-2 font-mono text-label uppercase tracking-wider text-[#8b8e99] group-hover:text-[#f2efe9] transition-colors tabular-nums">
                {item.year}
              </div>

              {/* Project / Institution */}
              <div className="md:col-span-4 font-[family-name:var(--font-display)] text-xl font-light text-[#f2efe9]">
                {item.project}
              </div>

              {/* Award / Distinction Name */}
              <div className="md:col-span-4 font-[family-name:var(--font-sans)] text-body text-[#8b8e99] group-hover:text-[#f2efe9]/90 transition-colors">
                {item.honor}
              </div>

              {/* Result */}
              <div className="md:col-span-2 md:text-right font-mono text-label uppercase tracking-widest text-[#8b8e99] group-hover:text-white transition-colors">
                {item.result}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
