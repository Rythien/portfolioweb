"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { SITE_DATA } from "@/content/site";
import { DURATION, EASE, ENTRANCE, STAGGER, prefersReducedMotion } from "@/lib/motion";
import { introReveal, useIntroStore } from "@/store/useIntroStore";
import Swap from "@/components/ui/Swap";

gsap.registerPlugin(useGSAP);

/**
 * Moment 1: the hero arrives line by line after the preloader. Each line
 * wipes up from below its own mask, 0.08 s apart, top to bottom: the meta
 * row, the marquee headline (WebGL, already scrolling while it was hidden,
 * so it never starts from still), the disciplines, the footer row.
 * Reduced motion: every line, marquee included, simply fades in.
 */
export default function Hero() {
  const containerRef = useRef<HTMLElement | null>(null);

  useGSAP(
    (_ctx, contextSafe) => {
      const root = containerRef.current;
      if (!root || !contextSafe) return;
      const lines = gsap.utils.toArray<HTMLElement>("[data-hero-line]", root);
      const masks = gsap.utils.toArray<HTMLElement>("[data-hero-mask]", root);
      const reduced = prefersReducedMotion();

      // Hidden until the preloader hands over; the marquee too
      gsap.set(lines, reduced ? { autoAlpha: 0 } : { yPercent: 100 });
      introReveal.marquee = 0;

      const play = contextSafe(() => {
        const tl = gsap.timeline({
          // Masks open once everything has landed, so magnetic links and
          // descenders are never clipped afterwards
          onComplete: () => gsap.set(masks, { overflow: "visible" }),
        });
        const enter = reduced
          ? { autoAlpha: 1, duration: DURATION.quick, ease: EASE.entrance }
          : { yPercent: 0, ...ENTRANCE };
        const [meta, ...rest] = lines;
        const at = (i: number) => i * STAGGER.standard;
        tl.to(meta, enter, at(0))
          .to(introReveal, { marquee: 1, ...(reduced ? { duration: DURATION.quick, ease: EASE.entrance } : ENTRANCE) }, at(1))
          .to(rest, { ...enter, stagger: STAGGER.standard }, at(2));
      });

      if (useIntroStore.getState().done) {
        play();
        return;
      }
      const unsubscribe = useIntroStore.subscribe((s) => {
        if (s.done) {
          unsubscribe();
          play();
        }
      });
      return unsubscribe;
    },
    { scope: containerRef }
  );

  return (
    <section
        ref={containerRef}
        id="top"
        aria-label="Hero Introduction"
        className="relative min-h-screen flex flex-col justify-between pt-28 pb-20 sm:pb-24 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto w-full overflow-hidden select-none"
      >
        {/* Top Metadata */}
        <div data-hero-mask className="relative z-10 overflow-hidden pt-4">
          <div data-hero-line data-reveal className="flex items-center justify-between font-mono text-label text-ink/80">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-ink" />
              <span>{SITE_DATA.brand.role}</span>
            </div>
            <div className="tabular-nums hidden sm:block">
              {SITE_DATA.brand.coordinates}
            </div>
          </div>
        </div>

        {/* The marquee headline sits here, in the WebGL scene */}
        <div className="relative z-10 my-auto" />

        {/* Bottom */}
        <div className="relative z-10">
          <div data-hero-mask className="mb-8 overflow-hidden">
            <div
              data-hero-line
              data-reveal
              className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-label text-ink/80"
            >
              {SITE_DATA.hero.disciplines.map((item, idx) => (
                <React.Fragment key={item}>
                  <span className="text-ink/90 hover:text-ink transition-colors">
                    {item}
                  </span>
                  {idx < SITE_DATA.hero.disciplines.length - 1 && (
                    <span className="text-ink/20">·</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div data-hero-mask className="overflow-hidden">
            <div
              data-hero-line
              data-reveal
              className="flex items-center justify-between border-t border-rule pt-6 font-mono text-label text-ink/80"
            >
              <div className="hidden sm:block">
                {SITE_DATA.brand.tagline}
              </div>

              <div>
                <a
                  href={SITE_DATA.hero.socialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hit underline underline-offset-4 decoration-ink/20"
                >
                  <Swap>{SITE_DATA.hero.socialLabel} ↗</Swap>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
