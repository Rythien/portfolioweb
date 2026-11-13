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
          duration: 0.8,
          stagger: 0.06,
          ease: "expo.out",
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
      className="scroll-mt-24 py-16 sm:py-24 lg:py-32 border-t border-rule relative"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        <div className="flex flex-col gap-12 sm:gap-16 max-w-5xl">
          <h2 className="contact-reveal font-[family-name:var(--font-sans)] text-display uppercase text-ink">
            {SITE_DATA.contact.headingPrefix}{" "}
            <span className="accent-word">{SITE_DATA.contact.headingAccent}</span>
          </h2>

          <p className="contact-reveal font-[family-name:var(--font-sans)] text-body-lg text-ink/70 leading-relaxed max-w-[60ch] [text-wrap:pretty]">
            {SITE_DATA.contact.subtext}
          </p>

          <div className="contact-reveal flex flex-wrap items-center gap-4 sm:gap-6 pt-4">
            <a
              href={`mailto:${SITE_DATA.contact.email}`}
              data-magnetic
              data-cursor="Email"
              className="pressable px-8 py-5 bg-ink text-surface font-mono text-label font-semibold hover:opacity-90 border border-ink"
            >
              Send Email ↗
            </a>

            <button
              onClick={handleCopyEmail}
              data-magnetic
              aria-label="Copy email address to clipboard"
              className="pressable px-6 py-5 border border-rule text-ink font-mono text-label hover:border-rule-hover"
            >
              {copied ? "Copied ✓" : `Copy: ${SITE_DATA.contact.email}`}
            </button>
          </div>

          <div className="contact-reveal grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-rule font-mono">
            <div className="flex flex-col gap-2">
              <span className="text-label text-ink/80">Location</span>
              <span className="text-ink text-sm">{SITE_DATA.contact.location}</span>
              <span className="text-sm text-ink/80">{SITE_DATA.contact.availability}</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-label text-ink/80">Phone</span>
              <a
                href={`tel:${SITE_DATA.contact.phone.replace(/\s+/g, "")}`}
                data-magnetic
                className="text-ink text-sm hover:underline underline-offset-4"
              >
                {SITE_DATA.contact.phone}
              </a>
              <span className="text-sm text-ink/80">Telegram / WhatsApp</span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-label text-ink/80">Elsewhere</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-label text-ink/80">
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
