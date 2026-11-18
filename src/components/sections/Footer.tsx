"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SITE_DATA } from "@/content/site";
import { useContactPoints } from "@/content/contactPoints";
import {
  DISTANCE,
  EASE,
  ENTRANCE,
  LOOP,
  OFFSET,
  QUICK,
  SCALE,
  TRIGGER,
  VELOCITY,
  prefersReducedMotion,
  revealLines,
  settleReveal,
} from "@/lib/motion";
import { getVelocity } from "@/lib/scroll";
import Swap from "@/components/ui/Swap";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** The ticker never runs slower than its base loop, nor faster than tickerMax. */
const clampSpeed = gsap.utils.clamp(1, VELOCITY.tickerMax);

const TICKER_ITEMS = ["Available for work", "2026", "Kathmandu"];

function TickerRun() {
  return (
    <span className="ticker-run flex items-center shrink-0">
      {Array.from({ length: 4 }).map((_, rep) => (
        <React.Fragment key={rep}>
          {TICKER_ITEMS.map((item) => (
            <span key={`${rep}-${item}`} className="flex items-center">
              <span className="px-6 sm:px-10 whitespace-nowrap">{item}</span>
              <span aria-hidden="true" className="text-ink/30">
                ·
              </span>
            </span>
          ))}
        </React.Fragment>
      ))}
    </span>
  );
}

export default function Footer() {
  // The address is assembled in the browser (see contactPoints.ts)
  const cp = useContactPoints();
  const rootRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      const reduced = prefersReducedMotion();
      const ticker = root.querySelector<HTMLElement>(".ticker");
      const track = root.querySelector<HTMLElement>(".ticker-track");
      const cta = root.querySelector<HTMLElement>("[data-cta]");
      const accent = cta?.querySelector<HTMLElement>(".accent-word");

      // Moment 7: the statement scales up from 0.92 and its italic word
      // arrives OFFSET.accent later. Reduced motion: it fades in.
      if (cta) {
        const tl = gsap.timeline({ scrollTrigger: { ...TRIGGER, trigger: cta } });
        settleReveal(tl);
        if (reduced) {
          tl.fromTo(cta, { autoAlpha: 0 }, { autoAlpha: 1, ...QUICK });
        } else {
          tl.fromTo(
            cta,
            { autoAlpha: 0, scale: SCALE.statementFrom, transformOrigin: "0% 100%" },
            { autoAlpha: 1, scale: 1, ...ENTRANCE }
          ).fromTo(
            accent ?? [],
            { autoAlpha: 0, y: DISTANCE.line },
            { autoAlpha: 1, y: 0, ...ENTRANCE },
            OFFSET.accent
          );
        }
      }

      // Moment 8: the ticker loops at its base speed and runs faster with
      // scroll velocity (either direction), easing back; it never stops.
      // Reduced motion: it holds still and fades in.
      if (!track || !ticker) return;
      if (reduced) {
        revealLines(ticker, { trigger: ticker });
        return;
      }
      const loop = gsap.to(track, {
        xPercent: -50,
        duration: LOOP.ticker,
        ease: EASE.linear,
        repeat: -1,
      });
      const speed = { v: 1 };
      const toSpeed = gsap.quickTo(speed, "v", {
        ...QUICK,
        onUpdate: () => {
          loop.timeScale(speed.v);
        },
      });
      const tick = () => {
        toSpeed(clampSpeed(1 + Math.abs(getVelocity()) * VELOCITY.tickerPerPx));
      };
      gsap.ticker.add(tick);
      return () => gsap.ticker.remove(tick);
    },
    { scope: rootRef }
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer ref={rootRef} data-intro className="relative z-[1] border-t border-rule select-none">
      {/* Slow ticker */}
      <div
        className="ticker overflow-hidden border-b border-rule py-4 font-mono text-label text-ink/80"
        aria-label={TICKER_ITEMS.join(", ")}
      >
        <div className="ticker-track flex w-max">
          <TickerRun />
          <span aria-hidden="true" className="contents">
            <TickerRun />
          </span>
        </div>
      </div>

      {/* Closing statement straight onto the copyright bar; the email
          actions, socials and local time live with Contact above. Bottom
          padding clears the fixed WAKE/DREAM pill */}
      <div className="footer-end max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full pt-14 sm:pt-20 flex flex-col gap-10 sm:gap-12">
        <a
          href={cp?.mailHref ?? "#contact"}
          data-cta
          data-reveal
          className="font-[family-name:var(--font-sans)] text-display uppercase text-ink w-fit"
        >
          <Swap>
            Get in <span className="accent-word inline-block">touch</span>
          </Swap>
        </a>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-rule pt-6 font-mono text-label text-ink/80">
          <span>{SITE_DATA.footer.copyright}</span>
          <button
            onClick={scrollToTop}
            className="hit pressable text-ink underline underline-offset-4 decoration-ink/20"
          >
            <Swap>{SITE_DATA.footer.backToTop}</Swap>
          </button>
        </div>
      </div>
    </footer>
  );
}
