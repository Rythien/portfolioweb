"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { revealBlock } from "@/lib/motion";
import { SITE_DATA } from "@/content/site";
import MaskWords from "@/components/ui/MaskWords";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function About() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const secondLangRef = useRef<HTMLDivElement | null>(null);

  // The statement reveals itself word by word (MaskWords); the body and
  // the second language follow as blocks
  useGSAP(
    () => {
      revealBlock([bodyRef.current, secondLangRef.current], { trigger: bodyRef.current });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="about"
      aria-label="About Searon Maharjan"
      className="scroll-mt-[108px] lg:scroll-mt-24 pt-16 sm:pt-24 lg:pt-32 section-end border-t border-rule relative"
    >
      <div data-skew className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* One copy column (max-w-4xl, 10 of 12 columns at 1280) for the
            statement and the body: the parked crystal lives in the empty
            column to its right. The statement stays at h2, so it holds 3-4
            lines on laptop widths instead of wrapping to 7 and clipping */}
        <div className="max-w-4xl" data-crystal-avoid>
          <MaskWords
            className="font-[family-name:var(--font-sans)] text-h2 text-ink [text-wrap:pretty]"
            parts={[
              { text: SITE_DATA.about.statementPrefix },
              { text: SITE_DATA.about.statementItalic, accent: true },
              { text: SITE_DATA.about.statementSuffix },
            ]}
          />

          <p
            ref={bodyRef}
            className="mt-10 sm:mt-14 font-[family-name:var(--font-sans)] text-body-lg text-ink/70 leading-relaxed max-w-[60ch] [text-wrap:pretty]"
          >
            {SITE_DATA.about.body}
          </p>

          <div
            ref={secondLangRef}
            className="mt-14 sm:mt-20 pt-8 sm:pt-10 border-t border-rule flex flex-col gap-3"
          >
            <div className="font-mono text-label text-ink/80">
              {SITE_DATA.about.secondaryLanguage.lang}
            </div>
            <p className="font-[family-name:var(--font-sans)] text-base sm:text-lg text-ink/90 italic leading-relaxed">
              &ldquo;{SITE_DATA.about.secondaryLanguage.quote}&rdquo;
            </p>
            <p className="font-[family-name:var(--font-sans)] text-small text-ink/80 leading-relaxed max-w-[60ch] [text-wrap:pretty]">
              {SITE_DATA.about.secondaryLanguage.translation}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
