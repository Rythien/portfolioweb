"use client";

import React, { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const statementRef = useRef<HTMLParagraphElement | null>(null);
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const secondLangRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        [statementRef.current, bodyRef.current, secondLangRef.current],
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.18,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
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
      id="about"
      aria-label="About Searon Maharjan"
      className="py-28 sm:py-36 lg:py-44 border-t border-white/[0.08] relative"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Numbered Section Tag */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-16 sm:mb-24 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
          <span>{SITE_DATA.about.sectionNum} · {SITE_DATA.about.title}</span>
          <span>ETHOS & ORIGIN</span>
        </div>

        <div className="max-w-4xl">
          {/* Large statement paragraph with one italic accent word */}
          <p
            ref={statementRef}
            className="font-[family-name:var(--font-display)] text-h1 font-light leading-[1.12] text-[#f2efe9] tracking-[-0.025em] [text-wrap:pretty]"
          >
            {SITE_DATA.about.statementPrefix}{" "}
            <span className="italic text-[#d8d4cb] font-serif font-normal">
              {SITE_DATA.about.statementItalic}
            </span>{" "}
            {SITE_DATA.about.statementSuffix}
          </p>

          {/* Longer explanatory body paragraph */}
          <p
            ref={bodyRef}
            className="mt-10 sm:mt-14 font-[family-name:var(--font-sans)] text-body-lg text-[#8b8e99] leading-relaxed max-w-[65ch] [text-wrap:pretty]"
          >
            {SITE_DATA.about.body}
          </p>

          {/* Second language version below it (Nepali script + English translation) */}
          <div
            ref={secondLangRef}
            className="mt-14 sm:mt-20 pt-8 sm:pt-10 border-t border-white/[0.08] flex flex-col gap-3 font-mono text-xs"
          >
            <div className="text-label uppercase tracking-widest text-[#8b8e99]">
              {SITE_DATA.about.secondaryLanguage.lang}
            </div>
            <p className="font-[family-name:var(--font-sans)] text-base sm:text-lg text-[#f2efe9]/90 italic leading-relaxed">
              &ldquo;{SITE_DATA.about.secondaryLanguage.quote}&rdquo;
            </p>
            <p className="text-label text-[#8b8e99] leading-relaxed max-w-[65ch]">
              {SITE_DATA.about.secondaryLanguage.translation}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
