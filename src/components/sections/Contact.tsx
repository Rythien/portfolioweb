"use client";

import React, { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { REVEAL } from "@/motion/language";
import { SITE_DATA } from "@/content/site";
import { useMounted } from "@/utils/useMounted";
import { useContactPoints } from "@/content/contactPoints";

gsap.registerPlugin(ScrollTrigger);

export default function Contact() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mounted = useMounted();
  // Email and phone exist only after hydration (null in the HTML)
  const cp = useContactPoints();
  const [copied, setCopied] = useState(false);
  const [timeStr, setTimeStr] = useState("--:--");

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

  const handleCopy = () => {
    if (!cp) return;
    navigator.clipboard.writeText(cp.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".contact-reveal",
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          ...REVEAL,
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
      id="contact"
      aria-label="Contact Searon Maharjan"
      className="scroll-mt-24 pt-16 sm:pt-24 lg:pt-32 contact-end border-t border-rule relative"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* One block: heading, line, the email actions with the socials
            and local time right under them, then location / phone */}
        <div className="flex flex-col max-w-5xl">
          <h2 className="contact-reveal font-[family-name:var(--font-sans)] text-display uppercase text-ink">
            {SITE_DATA.contact.headingPrefix}{" "}
            <span className="accent-word">{SITE_DATA.contact.headingAccent}</span>
          </h2>

          <p className="contact-reveal mt-8 sm:mt-10 font-[family-name:var(--font-sans)] text-body-lg text-ink/70 leading-relaxed max-w-[60ch] [text-wrap:pretty]">
            {SITE_DATA.contact.subtext}
          </p>

          <div className="contact-reveal mt-10 sm:mt-12 flex flex-wrap items-center gap-3 sm:gap-4">
            <a
              href={cp?.mailHref ?? "#contact"}
              data-magnetic
              data-cursor="Email"
              className="pressable px-8 py-5 bg-ink text-surface font-mono text-label font-semibold hover:opacity-90 border border-ink"
            >
              Send Email ↗
            </a>
            <button
              type="button"
              onClick={handleCopy}
              data-magnetic
              aria-label={copied ? "Email copied" : cp ? `Copy email address ${cp.email}` : "Copy email address"}
              className="pressable px-6 py-5 border border-rule text-ink font-mono text-label hover:border-rule-hover"
            >
              {/* Phones: the short label, so the button stays one line */}
              <span aria-live="polite">
                {copied ? (
                  "Copied ✓"
                ) : (
                  <>
                    <span className={cp ? "sm:hidden" : undefined}>Copy email</span>
                    {cp && <span className="max-sm:hidden">Copy: {cp.email}</span>}
                  </>
                )}
              </span>
            </button>
          </div>

          <div className="contact-reveal mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-label text-ink/80">
            {SITE_DATA.contact.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                data-magnetic
                className="py-1 hover:text-ink underline underline-offset-4 decoration-ink/20 hover:decoration-ink transition-colors"
              >
                {s.label} ↗
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
                  data-magnetic
                  className="text-ink text-sm hover:underline underline-offset-4"
                >
                  {cp.phone}
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
