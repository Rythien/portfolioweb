"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface ScrollWordsProps {
  text: string;
  className?: string;
  start?: string;
  end?: string;
  minOpacity?: number;
}

export default function ScrollWords({
  text,
  className = "",
  start = "top 78%",
  end = "bottom 48%",
  minOpacity = 0.38,
}: ScrollWordsProps) {
  const containerRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) return;

    const words = el.querySelectorAll<HTMLElement>("[data-scroll-word]");
    if (!words.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: minOpacity },
        {
          opacity: 1,
          stagger: 0.04,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start,
            end,
            scrub: true,
          },
        }
      );
    }, el);

    return () => ctx.revert();
  }, [start, end, minOpacity]);

  const words = text.split(" ");

  return (
    <p
      ref={containerRef}
      className={`relative font-[family-name:var(--font-sans)] leading-relaxed select-none ${className}`}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, idx) => (
          <span
            key={idx}
            data-scroll-word
            className="inline-block mr-[0.28em] transition-opacity duration-150"
            style={{ opacity: minOpacity }}
          >
            {word}
          </span>
        ))}
      </span>
    </p>
  );
}
