"use client";

import React from "react";
import { PORTFOLIO_DATA } from "@/data/portfolio";

export default function Colophon() {
  const { stack, ethics } = PORTFOLIO_DATA.colophon;

  return (
    <section
      id="colophon"
      aria-labelledby="colophon-heading"
      className="py-24 sm:py-32 lg:py-40 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 hairline-b"
    >
      <div className="flex items-center justify-between font-mono text-xs text-[var(--text-muted)] tracking-widest uppercase mb-12 sm:mb-16">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--accent)]" />
          [ 08 / 10 ] · COLOPHON &amp; SPECIFICATION
        </span>
        <span>SYSTEM SCHEMATICS</span>
      </div>

      <div className="mb-14">
        <h2
          id="colophon-heading"
          className="font-[family-name:var(--font-display)] text-h1 font-light tracking-tight text-[var(--text-primary)]"
        >
          The Site, Taken Apart.
        </h2>
        <p className="mt-3 max-w-[65ch] text-body text-[var(--text-secondary)] font-normal leading-relaxed [text-wrap:pretty]">
          Full technical disclosure of the frameworks, typography, rendering engines, and ethical design standards powering this portfolio.
        </p>
      </div>

      {/* Grid of Stack Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10 mb-12">
        {stack.map((item) => (
          <div
            key={item.name}
            className="p-6 bg-[var(--bg-void)] flex flex-col justify-between space-y-2 hover:bg-[var(--bg-surface)] transition-colors"
          >
            <div className="font-mono text-xs text-[var(--accent)] uppercase">
              {item.name}
            </div>
            <div className="font-[family-name:var(--font-display)] text-h3 font-light text-[var(--text-primary)]">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Ethical Rigor & Accessibility Pledges */}
      <div className="border border-white/10 p-6 sm:p-8 bg-[var(--bg-surface)]">
        <div className="font-mono text-xs uppercase text-[var(--text-muted)] tracking-widest mb-4">
          ETHICAL &amp; ACCESSIBILITY STANDARDS
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs sm:text-sm text-[var(--text-secondary)]">
          {ethics.map((e, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="text-[var(--accent)] font-bold">✓</span>
              <span>{e}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
