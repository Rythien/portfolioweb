"use client";

import React from "react";
import Link from "next/link";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";

export default function CVPage() {
  return (
    <LenisProvider>
      <div className="min-h-screen flex flex-col justify-between">
        <Header />

        <main className="max-w-4xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          <div className="flex items-center justify-between border-b border-rule pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-ink-muted">
            <Link
              href="/"
              data-magnetic
              className="hover:text-ink flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to home</span>
            </Link>
            <button
              onClick={() => window.print()}
              data-magnetic
              className="px-3 py-1.5 border border-rule hover:border-rule-hover text-ink rounded-sm transition-colors font-mono text-label"
            >
              Print / Save PDF
            </button>
          </div>

          <header className="mb-14">
            <div className="font-mono text-label uppercase tracking-widest text-ink-muted mb-3">
              Curriculum Vitae · 2026
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-display font-light text-ink tracking-tight">
              Searon Maharjan
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-lg sm:text-xl text-ink/80 font-normal leading-relaxed">
              Website and app designer and frontend developer in Kathmandu. I design interfaces and build them in code, from first sketch to launch. BICT graduate, Asia e University, 2025.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-ink-muted">
              <span>Kathmandu, Nepal (UTC+5:45)</span>
              <span>·</span>
              <a href="mailto:seron.maharjan.5@gmail.com" className="underline hover:text-ink">
                seron.maharjan.5@gmail.com
              </a>
              <span>·</span>
              <a
                href="https://github.com/rythien"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-ink"
              >
                github.com/rythien
              </a>
              <span>·</span>
              <a
                href="https://linkedin.com/in/searon-maharjan"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-ink"
              >
                linkedin.com/in/searon-maharjan
              </a>
            </div>
          </header>

          <section className="mb-14 pb-12 border-b border-rule">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-4">
              About
            </h2>
            <div className="space-y-4 font-[family-name:var(--font-sans)] text-base text-ink/80 leading-relaxed">
              <p>
                I&apos;m Searon, a website and app designer and frontend developer from Kathmandu, Nepal. I design interfaces from the first sketch to the final screen, then build them in code so nothing gets lost between the design and the launch.
              </p>
              <p>
                I finished my BICT degree at Asia e University in 2025, where I built a full e-commerce website as my capstone project. I have also used Blender during an internship, so I&apos;m comfortable bringing 3D into a project when it helps.
              </p>
            </div>
          </section>

          <section className="mb-14 pb-12 border-b border-rule">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-6">
              Experience
            </h2>
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between font-mono text-xs text-ink-faint mb-1">
                  <span>2024</span>
                  <span>Kathmandu</span>
                </div>
                <h3 className="text-xl font-light text-ink">
                  3D Modeling Intern
                </h3>
                <p className="mt-1 text-sm text-ink/80">
                  Used Blender to build 3D models and renders.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between font-mono text-xs text-ink-faint mb-1">
                  <span>2021 — 2025</span>
                  <span>Asia e University</span>
                </div>
                <h3 className="text-xl font-light text-ink">
                  Bachelor of Information and Communication Technology (BICT)
                </h3>
                <p className="mt-1 text-sm text-ink/80">
                  Graduated 2025. Capstone project: designed and built a full e-commerce website.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-14 pb-12 border-b border-rule">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-6">
              Skills
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              <div className="border border-rule p-5 rounded-sm">
                <span className="text-ink font-semibold block mb-3 uppercase tracking-wider">
                  Design
                </span>
                <p className="text-ink-muted leading-relaxed font-[family-name:var(--font-sans)] text-sm">
                  Interface design (UI), user experience (UX), responsive layouts, design systems, wireframes and prototypes, Figma.
                </p>
              </div>
              <div className="border border-rule p-5 rounded-sm">
                <span className="text-ink font-semibold block mb-3 uppercase tracking-wider">
                  Code
                </span>
                <p className="text-ink-muted leading-relaxed font-[family-name:var(--font-sans)] text-sm">
                  HTML & CSS, JavaScript, TypeScript, React, Next.js, Tailwind CSS, Git.
                </p>
              </div>
              <div className="border border-rule p-5 rounded-sm">
                <span className="text-ink font-semibold block mb-3 uppercase tracking-wider">
                  3D
                </span>
                <p className="text-ink-muted leading-relaxed font-[family-name:var(--font-sans)] text-sm">
                  Blender (modeling and rendering).
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-4">
              Process
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-mono text-xs">
              {[
                ["01 / Listen", "Understand the goal and users."],
                ["02 / Map", "Plan user journeys and architecture."],
                ["03 / Sketch", "Quick wireframes and flows."],
                ["04 / Design", "Type, color, layout & clickable prototype."],
                ["05 / Build", "Responsive React/Next.js/Tailwind code."],
                ["06 / Test & Ship", "Speed, accessibility (WCAG AA), launch."],
              ].map(([label, desc]) => (
                <div key={label} className="p-3 border border-rule">
                  <span className="text-ink-faint block mb-1">{label}</span>
                  <span className="font-[family-name:var(--font-sans)] text-xs text-ink/80">{desc}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
