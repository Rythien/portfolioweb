"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { STAGGER, counterTo, wipeFromLeft } from "@/lib/motion";
import { SITE_DATA } from "@/content/site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Row numbers are two digits: 01, 02 ... */
const NUMBER_PAD = 2;

/**
 * Moment 3: the rows come out of the list's left rule one after another,
 * each number counting up as its row enters. Hovering a row drops the
 * others to 40% (CSS: .discipline-list in globals.css). Reduced motion:
 * the rows fade in and the numbers simply show.
 */
export default function Disciplines() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rowsRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const rows = gsap.utils.toArray<HTMLElement>(".discipline-row", sectionRef.current);
      const tl = wipeFromLeft(rows, { trigger: rowsRef.current });
      rows.forEach((row, i) => {
        const num = row.querySelector<HTMLElement>("[data-count]");
        if (!num) return;
        // Each count starts as its own row starts to appear
        tl.add(counterTo(num, Number(num.dataset.count), { pad: NUMBER_PAD }), i * STAGGER.tight);
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="disciplines"
      aria-label="Disciplines and Expertise"
      className="scroll-mt-[108px] lg:scroll-mt-20 pt-32 section-end border-t border-rule"
    >
      <div data-skew className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div
          ref={rowsRef}
          className="discipline-list divide-y divide-rule border-b border-l border-rule"
        >
          {/* Heading and description sit in their own columns with a real
              gutter; cols 11-12 stay empty at lg for the parked crystal.
              Grid rows size to the taller of the two cells. Each row clears
              the header (80px, plus the 28px strip below lg) when linked. */}
          {SITE_DATA.disciplines.items.map((item) => (
            <div
              key={item.number}
              id={`discipline-${item.number}`}
              className="discipline-row group scroll-mt-[108px] lg:scroll-mt-20 py-10 sm:py-12 pl-6 sm:pl-8 grid grid-cols-1 md:grid-cols-12 gap-y-5 md:gap-x-8 lg:gap-x-12 items-start"
            >
              <div data-crystal-avoid className="discipline-head md:col-span-7 lg:col-span-6 flex flex-col gap-4 min-w-0">
                <div className="font-mono text-label uppercase tracking-widest text-ink-muted group-hover:text-ink transition-colors tabular-nums">
                  (<span data-count={Number(item.number)}>{item.number}</span>)
                </div>
                <div className="discipline-title font-[family-name:var(--font-sans)] text-h2 uppercase text-ink/90 group-hover:text-ink transition-[color,transform] group-hover:translate-x-2">
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
