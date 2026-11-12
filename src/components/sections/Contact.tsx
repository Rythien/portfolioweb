"use client";

import React, { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE_DATA } from "@/content/site";

gsap.registerPlugin(ScrollTrigger);

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

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
          duration: 0.9,
          stagger: 0.15,
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

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SITE_DATA.contact.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      aria-label="Contact Searon Maharjan"
      className="scroll-mt-24 py-32 sm:py-44 border-t border-rule relative"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="flex items-center justify-between border-b border-rule pb-4 mb-20 sm:mb-28 font-mono text-label uppercase tracking-widest text-ink-muted">
          <span>{SITE_DATA.contact.sectionNum} · {SITE_DATA.contact.title}</span>
        </div>

        <div className="flex flex-col gap-12 sm:gap-16 max-w-5xl">
          <h2 className="contact-reveal font-[family-name:var(--font-sans)] text-display uppercase text-ink">
            {SITE_DATA.contact.heading}
          </h2>

          <p className="contact-reveal font-[family-name:var(--font-sans)] text-body-lg text-ink/70 leading-relaxed max-w-[60ch] [text-wrap:pretty]">
            {SITE_DATA.contact.subtext}
          </p>

          <div className="contact-reveal flex flex-wrap items-center gap-4 sm:gap-6 pt-4">
            <a
              href={`mailto:${SITE_DATA.contact.email}`}
              data-magnetic
              data-cursor="Email"
              className="px-8 py-5 bg-ink text-surface font-mono text-xs sm:text-sm uppercase tracking-widest font-semibold hover:opacity-90 transition-all duration-300 border border-ink"
            >
              Send Email ↗
            </a>

            <button
              onClick={handleCopyEmail}
              data-magnetic
              aria-label="Copy email address to clipboard"
              className="px-6 py-5 border border-rule text-ink font-mono text-xs uppercase tracking-widest hover:border-rule-hover transition-colors"
            >
              {copied ? "Copied ✓" : `Copy: ${SITE_DATA.contact.email}`}
            </button>
          </div>

          <div className="contact-reveal grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-rule font-mono text-xs">
            <div className="flex flex-col gap-2">
              <span className="text-label uppercase tracking-widest text-ink-faint">Location</span>
              <span className="text-ink text-sm">{SITE_DATA.contact.location}</span>
              <span className="text-ink-muted">{SITE_DATA.contact.availability}</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-label uppercase tracking-widest text-ink-faint">Phone</span>
              <a
                href={`tel:${SITE_DATA.contact.phone.replace(/\s+/g, "")}`}
                data-magnetic
                className="text-ink text-sm hover:underline underline-offset-4"
              >
                {SITE_DATA.contact.phone}
              </a>
              <span className="text-ink-muted">Telegram / WhatsApp</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-label uppercase tracking-widest text-ink-faint">Elsewhere</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2 uppercase tracking-wider text-ink-muted">
                {SITE_DATA.contact.socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-magnetic
                    className="hover:text-ink underline underline-offset-4 decoration-ink/20 hover:decoration-ink transition-colors"
                  >
                    {s.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
