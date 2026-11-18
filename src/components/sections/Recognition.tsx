"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { drawRules, revealLines } from "@/lib/motion";
import { SITE_DATA } from "@/content/site";
import Counter from "@/components/ui/Counter";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Recognition() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);

  // Moment 6: rows rise on a 0.04 stagger while each row's hairline draws
  // left to right on the same beat. Reduced motion: rows fade, rules show.
  useGSAP(
    () => {
      const root = sectionRef.current;
      const trigger = rowsRef.current;
      revealLines(gsap.utils.toArray(".recognition-row", root), { trigger });
      drawRules(gsap.utils.toArray(".recognition-rule", root), { trigger });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="recognition"
      aria-label="Awards and Recognition"
      className="scroll-mt-24 pt-16 sm:pt-24 lg:pt-32 section-end border-t border-rule"
    >
      <div data-skew className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="mb-12 sm:mb-16 flex flex-col sm:flex-row items-baseline gap-6 sm:gap-12">
          <div className="font-mono text-display sm:text-8xl font-medium text-ink tabular-nums tracking-tighter">
            <Counter value={parseInt(SITE_DATA.recognition.totalAccolades, 10)} padDigits={2} />
          </div>
          <div className="font-mono text-label uppercase tracking-widest text-ink-muted max-w-xs">
            {SITE_DATA.recognition.accoladesLabel}
          </div>
        </div>

        {/* Each row carries its own bottom hairline (it draws in), in place
            of the list's divide-y and border-b */}
        <div ref={rowsRef}>
          {SITE_DATA.recognition.items.map((item, idx) => (
            <div
              key={idx}
              className="recognition-row group relative py-6 sm:py-8 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-baseline transition-colors hover:bg-ink/[0.03] px-2 sm:px-4 -mx-2 sm:-mx-4"
            >
              <div className="md:col-span-2 font-mono text-label uppercase tracking-wider text-ink-muted group-hover:text-ink transition-colors tabular-nums">
                {item.year}
              </div>

              <div className="md:col-span-4 font-[family-name:var(--font-display)] text-xl font-normal text-ink">
                {item.project}
              </div>

              <div className="md:col-span-4 font-[family-name:var(--font-sans)] text-body text-ink-muted group-hover:text-ink/90 transition-colors">
                {item.honor}
              </div>

              <div className="md:col-span-2 md:text-right font-mono text-label uppercase tracking-widest text-ink-muted group-hover:text-ink transition-colors">
                {item.result}
              </div>
              <span
                aria-hidden="true"
                className="recognition-rule pointer-events-none absolute inset-x-0 bottom-0 h-px bg-rule"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
