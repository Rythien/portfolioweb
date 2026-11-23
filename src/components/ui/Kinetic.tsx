"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DURATION, revealLines } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger);

/**
 * Characters share one quick spread instead of a per-character step, so a
 * long heading still lands inside the 0.5 s stagger budget.
 */
const CHAR_STAGGER = { amount: DURATION.quick } as const;

interface KineticHeadingProps {
  children: string;
  as?: "h1" | "h2" | "h3" | "span" | "div";
  className?: string;
  /** Fixed variable-font weight. It never follows the cursor: a weight
   * change reflows the line, which reads as the text moving. */
  weight?: number;
  stagger?: gsap.TweenVars["stagger"];
}

export default function KineticHeading({
  children,
  as: Component = "h2",
  className = "",
  weight = 300,
  stagger = CHAR_STAGGER,
}: KineticHeadingProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chars = el.querySelectorAll<HTMLElement>("[data-kinetic-char]");
    if (!chars.length) return;

    const ctx = gsap.context(() => {
      revealLines(chars, {
        trigger: el,
        stagger,
        scrollTrigger: {
          start: "top 90%",
          toggleActions: "play none none none",
          once: true,
          fastScrollEnd: true,
        },
      });
    }, el);

    return () => ctx.revert();
  }, [stagger]);

  const words = children.split(" ");

  return (
    <Component
      ref={containerRef as React.RefObject<HTMLHeadingElement>}
      className={`font-[family-name:var(--font-display)] relative leading-[1.1] tracking-tight [text-wrap:balance] ${className}`}
    >
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className="block select-none overflow-visible">
        {words.map((word, wIdx) => (
          <span
            key={wIdx}
            className="inline-block whitespace-nowrap mr-[0.28em] py-[0.22em] -my-[0.22em] overflow-visible"
          >
            {word.split("").map((char, cIdx) => (
              <span key={cIdx} className="inline-block overflow-visible">
                <span
                  data-kinetic-char
                  className="inline-block will-change-transform will-change-opacity"
                  style={{ fontVariationSettings: `'wght' ${weight}` }}
                >
                  {char}
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </Component>
  );
}
