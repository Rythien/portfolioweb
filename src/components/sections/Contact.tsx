"use client";

import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { EASE, HOLD, HOVER, STAGGER, prefersReducedMotion, revealBlock } from "@/lib/motion";
import MaskWords from "@/components/ui/MaskWords";
import Swap from "@/components/ui/Swap";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";
import { useContactPoints } from "@/content/contactPoints";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function Contact() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mounted = useMounted();
  // Email and phone exist only after hydration (null in the HTML)
  const cp = useContactPoints();
  const [copied, setCopied] = useState(false);
  const [timeStr, setTimeStr] = useState("--:--");
  // Copy button morph: the idle label and "Copied" share one clipped cell
  const idleRef = useRef<HTMLSpanElement | null>(null);
  const doneRef = useRef<HTMLSpanElement | null>(null);
  const checkRef = useRef<SVGPathElement | null>(null);
  const morphRef = useRef<gsap.core.Timeline | null>(null);
  const holdRef = useRef<gsap.core.Tween | null>(null);

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

  // "Copy" rises out, "Copied" rises in and its check draws itself; after
  // HOLD.confirm it runs back at 60% of that time. Reduced motion: it
  // swaps without moving.
  const handleCopy = () => {
    const tl = morphRef.current;
    if (!cp || !tl) return;
    navigator.clipboard
      .writeText(cp.email)
      .then(() => {
        setCopied(true);
        holdRef.current?.kill();
        tl.timeScale(1).play();
        holdRef.current = gsap.delayedCall(HOLD.confirm, () => {
          tl.timeScale(1 / HOVER.ratio).reverse();
          setCopied(false);
        });
      })
      .catch(() => {
        // No clipboard (permissions, insecure context): the mailto
        // button beside it still works, so stay as we are
      });
  };

  // The heading reveals word by word (MaskWords); the rest follow as blocks
  useGSAP(
    () => {
      revealBlock(".contact-reveal", { trigger: sectionRef.current });

      const reduced = prefersReducedMotion();
      const enter = { duration: reduced ? 0 : HOVER.enter, ease: EASE.entrance };
      gsap.set(doneRef.current, { yPercent: 100 });
      gsap.set(checkRef.current, { strokeDashoffset: 1 });
      morphRef.current = gsap
        .timeline({ paused: true })
        .to(idleRef.current, { yPercent: -100, ...enter })
        .to(doneRef.current, { yPercent: 0, ...enter }, "<")
        .to(checkRef.current, { strokeDashoffset: 0, ...enter }, reduced ? "<" : `<${STAGGER.standard}`);
      return () => holdRef.current?.kill();
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="contact"
      aria-label="Contact Searon Maharjan"
      className="scroll-mt-24 pt-16 sm:pt-24 lg:pt-32 contact-end border-t border-rule relative"
    >
      <div data-skew className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* One block: heading, line, the email actions with the socials
            and local time right under them, then location / phone */}
        <div className="flex flex-col max-w-5xl">
          <MaskWords
            as="h2"
            className="font-[family-name:var(--font-sans)] text-display uppercase text-ink"
            parts={[
              { text: SITE_DATA.contact.headingPrefix },
              { text: SITE_DATA.contact.headingAccent, accent: true },
            ]}
          />

          <p className="contact-reveal mt-8 sm:mt-10 font-[family-name:var(--font-sans)] text-body-lg text-ink/70 leading-relaxed max-w-[60ch] [text-wrap:pretty]">
            {SITE_DATA.contact.subtext}
          </p>

          <div className="contact-reveal mt-10 sm:mt-12 flex flex-wrap items-center gap-3 sm:gap-4">
            <a
              href={cp?.mailHref ?? "#contact"}
              className="pressable px-8 py-5 bg-ink text-surface font-mono text-label font-semibold border border-ink"
            >
              <Swap>Send Email ↗</Swap>
            </a>
            <button
              type="button"
              onClick={handleCopy}
              data-magnetic
              aria-label={copied ? "Email copied" : cp ? `Copy email address ${cp.email}` : "Copy email address"}
              className="pressable px-6 py-5 border border-rule text-ink font-mono text-label"
            >
              <span className="copy-morph">
                <span ref={idleRef}>
                  {/* Phones: the short label, so the button stays one line */}
                  <span className={cp ? "sm:hidden" : undefined}>
                    <Swap>Copy email</Swap>
                  </span>
                  {cp && (
                    <span className="max-sm:hidden">
                      <Swap>Copy: {cp.email}</Swap>
                    </span>
                  )}
                </span>
                <span
                  ref={doneRef}
                  aria-hidden="true"
                  className="inline-flex items-center justify-center gap-2"
                >
                  Copied
                  <svg viewBox="0 0 12 12" width="12" height="12" className="copy-check" aria-hidden="true">
                    <path ref={checkRef} d="M1.5 6.5 4.5 9.5 10.5 2.5" pathLength={1} strokeDasharray="1" />
                  </svg>
                </span>
              </span>
            </button>
            {/* Announces the copy once; the button's own name says so too */}
            <span className="sr-only" aria-live="polite">
              {copied ? "Email copied" : ""}
            </span>
          </div>

          <div className="contact-reveal mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-label text-ink/80">
            {SITE_DATA.contact.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hit underline underline-offset-4 decoration-ink/20"
              >
                <Swap>{s.label} ↗</Swap>
              </a>
            ))}
            <span
              className="tabular-nums text-ink/80 sm:border-l sm:border-rule sm:pl-6"
              suppressHydrationWarning
              title={`${SITE_DATA.brand.city} local time`}
            >
              {SITE_DATA.brand.city} {mounted ? timeStr : "--:--"}
            </span>
          </div>

          <div className="contact-reveal mt-12 sm:mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-rule font-mono">
            <div className="flex flex-col gap-2">
              <span className="text-label text-ink/80">Location</span>
              <span className="text-ink text-sm">{SITE_DATA.contact.location}</span>
              <span className="text-sm text-ink/80">{SITE_DATA.contact.availability}</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-label text-ink/80">Phone</span>
              {cp ? (
                <a
                  href={cp.phoneHref}
                  className="hit text-ink text-sm"
                >
                  <Swap>{cp.phone}</Swap>
                </a>
              ) : (
                // Same character count in the mono face, so nothing shifts
                // when the number arrives
                <span aria-hidden="true" className="text-ink/40 text-sm">
                  +··· ··········
                </span>
              )}
              <span className="text-sm text-ink/80">Telegram / WhatsApp</span>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
