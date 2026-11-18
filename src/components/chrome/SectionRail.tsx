"use client";

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";
import { EASE } from "@/lib/motion";

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
 * Below lg it collapses to a horizontal strip under the header. Purely
 * informational, duplicated by real headings.
 */
export default function SectionRail() {
  const mounted = useMounted();
  const [active, setActive] = useState("Intro");
  const [timeStr, setTimeStr] = useState("--:--");
  const fillRef = useRef<HTMLDivElement | null>(null);
  const stripFillRef = useRef<HTMLDivElement | null>(null);

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
            // The footer closes the Contact block: it reads as Contact
            const id = entry.target.tagName === "FOOTER" ? "contact" : entry.target.id;
            const match = SECTIONS.find((s) => s.id === id);
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
    // Without it, jumping to the bottom (End key) left the rail on the
    // last section seen in the middle band
    const footer = document.querySelector("footer");
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  // 1px progress line, scrubbed over the whole document (vertical on the
  // desktop rail, horizontal on the narrow-screen strip)
  useEffect(() => {
    const tweens = [
      fillRef.current &&
        gsap.fromTo(fillRef.current, { scaleY: 0 }, { scaleY: 1, ease: EASE.linear }),
      stripFillRef.current &&
        gsap.fromTo(stripFillRef.current, { scaleX: 0 }, { scaleX: 1, ease: EASE.linear }),
    ].filter(Boolean) as gsap.core.Tween[];
    const trigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => tweens.forEach((t) => t.progress(self.progress)),
    });
    tweens.forEach((t) => t.pause(0));
    return () => {
      trigger.kill();
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <>
      {/* Narrow screens: the rail collapses to a strip under the header */}
      <div
        aria-hidden="true"
        data-reveal
        data-rail-strip
        className="fixed left-0 right-0 top-20 z-40 lg:hidden h-7 px-6 sm:px-10 flex items-center gap-3 bg-surface border-b border-rule pointer-events-none select-none"
      >
        <span
          key={active}
          className="font-mono text-label text-ink/80 whitespace-nowrap strip-label-in"
        >
          {active}
        </span>
        <div className="relative flex-1 h-px bg-rule">
          <div
            ref={stripFillRef}
            className="absolute inset-0 bg-ink origin-left"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>

    <div
      aria-hidden="true"
      data-reveal
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
    </>
  );
}
