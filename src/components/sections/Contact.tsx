"use client";

import React, { useState } from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const { email, phone, location, availability, socials } = PORTFOLIO_DATA.contact;

  const copyEmail = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 09 / 10 ] · INITIATE TRANSMISSION
        </span>
        <span>GLOBAL COLLABORATION</span>
      </div>

      <div className="mb-14">
        <h2
          id="contact-heading"
          className="font-[family-name:var(--font-syne)] text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter text-[var(--text-primary)] uppercase leading-[0.95]"
        >
          Let&apos;s Work
          <br />
          <span className="text-[var(--accent)]">Together.</span>
        </h2>

        <p className="mt-6 max-w-2xl text-base sm:text-xl text-[var(--text-secondary)] font-light leading-relaxed">
          Open for principal frontend engineering, interactive 3D / WebGL creative direction, and bespoke digital commissions worldwide.
        </p>
      </div>

      {/* Magnetic Email Action Button & Copy Interactivity */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-16 border-b border-white/10">
        <a
          href={`mailto:${email}`}
          data-cursor-text="EMAIL"
          className="group inline-flex items-center gap-4 px-8 py-5 bg-[var(--accent)] text-white font-mono text-sm sm:text-base font-bold uppercase tracking-wider transition-all duration-300 hover:bg-white hover:text-black"
        >
          <span>SEND DISPATCH: {email}</span>
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            ↗
          </span>
        </a>

        <button
          onClick={copyEmail}
          aria-label="Copy Email to Clipboard"
          className="px-6 py-5 border border-white/20 font-mono text-xs uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          {copied ? "[ COPIED TO CLIPBOARD ✓ ]" : "[ COPY ADDRESS ]"}
        </button>
      </div>

      {/* Contact Details & Social Networks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
        {/* Availability & Location */}
        <div className="space-y-4">
          <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider">
            BASE STATION &amp; CADENCE
          </div>
          <div className="font-mono text-xs sm:text-sm text-[var(--text-primary)] space-y-1">
            <div>{location}</div>
            <div className="text-[var(--text-secondary)]">{availability}</div>
            <div className="text-[var(--text-muted)] pt-2">Direct Phone: {phone}</div>
          </div>
        </div>

        {/* Social Networks List */}
        <div className="space-y-4">
          <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider">
            NETWORKS &amp; PROFILES
          </div>
          <div className="flex flex-col space-y-2 font-mono text-xs sm:text-sm">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center justify-between group"
              >
                <span>{s.label}</span>
                <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)]">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Credentials / Curriculum Vitae */}
        <div className="space-y-4">
          <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-wider">
            CURRICULUM VITAE
          </div>
          <p className="font-mono text-xs text-[var(--text-secondary)] leading-relaxed">
            Comprehensive history of client work, patent filings, and engineering case studies.
          </p>
          <a
            href="/resume.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-mono text-xs text-[var(--accent)] hover:underline pt-2"
          >
            <span>DOWNLOAD CURRICULUM VITAE (.PDF)</span>
            <span>↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}
