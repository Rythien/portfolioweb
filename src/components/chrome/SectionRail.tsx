"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";

gsap.registerPlugin(ScrollTrigger);

const SECTIONS: { id: string; label: string }[] = [
  { id: "top", label: "Intro" },
  { id: "about", label: "About" },
  { id: "disciplines", label: "Disciplines" },
  { id: "works", label: "Selected Works" },
  { id: "recognition", label: "Recognition" },
  { id: "contact", label: "Contact" },
];

/**
 * Fixed left rail: active section name (rotated), 1px scroll progress
 * line, local time. Replaces the in-flow "(01) · ABOUT" section headers.
 * Desktop only; purely informational, duplicated by real headings.
 */
export default function SectionRail() {
  const mounted = useMounted();
  const [active, setActive] = useState("Intro");
  const [timeStr, setTimeStr] = useState("--:--");
  const fillRef = useRef<HTMLDivElement | null>(null);

  // Local time (rail owns the clock)
  useEffect(() => {
    const update = () => {
      try {
        setTimeStr(
          new Date().toLocaleTimeString("en-GB", {
            timeZone: SITE_DATA.brand.timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        );
      } catch {
        setTimeStr("--:--");
      }
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  // Active section via IntersectionObserver (works with and without Lenis)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = SECTIONS.find((s) => s.id === entry.target.id);
            if (match) setActive(match.label);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // 1px progress line, scrubbed over the whole document
  useEffect(() => {
    if (!fillRef.current) return;
    const tween = gsap.fromTo(
      fillRef.current,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: document.documentElement,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex w-12 flex-col items-center gap-6 pt-28 pb-8 pointer-events-none select-none"
    >
      <div className="h-44 flex items-start justify-center overflow-hidden">
        <span
          key={active}
          className="font-mono text-label text-ink/80 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap rail-label-in"
        >
          {active}
        </span>
      </div>

      <div className="relative flex-1 w-px bg-rule">
        <div
          ref={fillRef}
          className="absolute inset-0 bg-ink origin-top"
          style={{ transform: "scaleY(0)" }}
        />
      </div>

      <div
        className="font-mono text-label text-ink/80 tabular-nums [writing-mode:vertical-rl] rotate-180"
        suppressHydrationWarning
      >
        {mounted ? timeStr : "--:--"}
      </div>
    </div>
  );
}
