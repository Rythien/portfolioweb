"use client";

import React, { useRef, useEffect } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";
import { gsap } from "gsap";

export default function Skills() {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!prefersReducedMotion) {
      const ctx = gsap.context(() => {
        gsap.from(".skill-col", {
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
            toggleActions: "play none none reverse",
          },
          y: 30,
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
          ease: "power3.out",
        });
      }, containerRef);

      return () => ctx.revert();
    }
  }, []);

  const { grouped, areasOfExpertise } = PORTFOLIO_DATA.skills;

  return (
    <section
      ref={containerRef}
      id="skills"
      aria-labelledby="skills-heading"
      className="py-24 sm:py-32 lg:py-40 border-t border-white/[0.08] bg-[#050505]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between font-mono text-xs text-[#8e8b82] tracking-widest uppercase mb-12 sm:mb-16">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-[#edebe6]" />
            [ 03 / 07 ] · SKILLS &amp; STACK
          </span>
          <span>STACK · 25 TOTAL</span>
        </div>

        <div className="mb-14">
          <h2
            id="skills-heading"
            className="font-[family-name:var(--font-display)] text-3xl sm:text-5xl font-normal tracking-tight text-[#edebe6]"
          >
            Engineering Arsenal.
          </h2>
        </div>

        {/* Grouped Skills Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-16">
          {grouped.map((group) => (
            <div
              key={group.category}
              className="skill-col border-t border-white/10 pt-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between font-mono text-xs mb-4">
                  <span className="text-[#8e8b82] uppercase tracking-wider">
                    {group.category}
                  </span>
                  <span className="text-white font-semibold">
                    {group.count}
                  </span>
                </div>

                <ul className="space-y-2.5 font-mono text-xs sm:text-sm text-[#8e8b82]">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 transition-colors duration-200 hover:text-white"
                    >
                      <span className="h-1 w-1 bg-white/40 rounded-full" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Areas of Expertise with Slashes */}
        <div className="border-t border-white/10 pt-12">
          <div className="font-mono text-xs uppercase text-[#8e8b82] tracking-widest mb-6">
            AREAS OF EXPERTISE
          </div>

          <div className="flex flex-wrap items-center gap-y-3 font-[family-name:var(--font-display)] text-lg sm:text-2xl font-normal text-[#8e8b82] leading-relaxed">
            {areasOfExpertise.map((area, idx) => (
              <React.Fragment key={area}>
                <span className="hover:text-white transition-colors duration-200">
                  {area}
                </span>
                {idx < areasOfExpertise.length - 1 && (
                  <span className="mx-4 font-mono text-sm sm:text-base font-normal text-white/20 select-none">
                    /
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
