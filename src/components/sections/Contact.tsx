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
      className="py-32 sm:py-44 border-t border-white/[0.08] relative"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-20 sm:mb-28 font-mono text-label uppercase tracking-widest text-[#8b8e99]">
          <span>{SITE_DATA.contact.sectionNum} · {SITE_DATA.contact.title}</span>
          <span>INITIATE COLLABORATION</span>
        </div>

        <div className="flex flex-col gap-12 sm:gap-16 max-w-5xl">
          {/* Giant "Say hello." Heading */}
          <h2 className="contact-reveal font-[family-name:var(--font-display)] text-[clamp(3.5rem,12vw,9.5rem)] font-light text-[#f2efe9] leading-[0.92] tracking-[-0.035em]">
            {SITE_DATA.contact.heading}
          </h2>

          <p className="contact-reveal font-[family-name:var(--font-sans)] text-body-lg sm:text-2xl text-[#8b8e99] leading-relaxed max-w-[65ch] [text-wrap:pretty]">
            {SITE_DATA.contact.subtext}
          </p>

          {/* Email Action & Clipboard Button */}
          <div className="contact-reveal flex flex-wrap items-center gap-4 sm:gap-6 pt-4">
            <a
              href={`mailto:${SITE_DATA.contact.email}`}
              data-magnetic
              data-cursor="Email"
              className="px-8 py-5 bg-[#f2efe9] text-[#08080a] font-mono text-xs sm:text-sm uppercase tracking-widest font-semibold hover:bg-white transition-all duration-300 border border-[#f2efe9]"
            >
              Dispatch Email ↗
            </a>

            <button
              onClick={handleCopyEmail}
              data-magnetic
              aria-label="Copy email address to clipboard"
              className="px-6 py-5 border border-white/20 text-[#f2efe9] font-mono text-xs uppercase tracking-widest hover:border-white transition-colors"
            >
              {copied ? "[ COPIED TO CLIPBOARD ✓ ]" : `[ COPY: ${SITE_DATA.contact.email} ]`}
            </button>
          </div>

          {/* Direct Details & Social Links Grid */}
          <div className="contact-reveal grid grid-cols-1 md:grid-cols-3 gap-8 pt-16 border-t border-white/[0.08] font-mono text-xs">
            {/* Location & Time */}
            <div className="flex flex-col gap-2">
              <span className="text-label uppercase tracking-widest text-white/40">Base Station</span>
              <span className="text-[#f2efe9] text-sm">{SITE_DATA.contact.location}</span>
              <span className="text-[#8b8e99]">{SITE_DATA.contact.availability}</span>
            </div>

            {/* Direct Phone */}
            <div className="flex flex-col gap-2">
              <span className="text-label uppercase tracking-widest text-white/40">Direct Line</span>
              <a
                href={`tel:${SITE_DATA.contact.phone.replace(/\s+/g, "")}`}
                data-magnetic
                className="text-[#f2efe9] text-sm hover:underline underline-offset-4"
              >
                {SITE_DATA.contact.phone}
              </a>
              <span className="text-[#8b8e99]">Telegram / WhatsApp</span>
            </div>

            {/* Social Network Links */}
            <div className="flex flex-col gap-2">
              <span className="text-label uppercase tracking-widest text-white/40">Digital Footprint</span>
              <div className="flex flex-wrap gap-x-5 gap-y-2 uppercase tracking-wider text-[#8b8e99]">
                {SITE_DATA.contact.socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-magnetic
                    className="hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white transition-colors"
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
