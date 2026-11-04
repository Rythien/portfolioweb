"use client";

import React from "react";
import Link from "next/link";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";

export default function CVPage() {
  return (
    <LenisProvider>
      <div className="min-h-screen bg-[#050505] text-[#edebe6] flex flex-col justify-between selection:bg-[#edebe6] selection:text-[#050505]">
        <Header />

        <main className="max-w-4xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          {/* Top Bar with Print Button and Back Link */}
          <div className="flex items-center justify-between border-b border-white/[0.1] pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-[#edebe6]/60">
            <Link
              href="/"
              data-magnetic
              className="hover:text-white flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to home</span>
            </Link>
            <button
              onClick={() => window.print()}
              data-magnetic
              className="px-3 py-1.5 border border-white/20 hover:border-white text-[#edebe6] rounded-sm transition-colors font-mono text-label"
            >
              Print / Save PDF
            </button>
          </div>

          {/* Header Info */}
          <header className="mb-14">
            <div className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75 mb-3">
              CURRICULUM VITAE · 2026
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-display font-light text-[#edebe6] tracking-tight">
              Searon Maharjan
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-lg sm:text-xl text-[#edebe6]/80 font-normal leading-relaxed">
              Website and app designer and frontend developer in Kathmandu. I design interfaces and build them in code, from first sketch to launch. BICT graduate, Asia e University, 2025.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-[#edebe6]/60">
              <span>Kathmandu, Nepal (UTC+5:45)</span>
              <span>•</span>
              <a href="mailto:[YOUR EMAIL]" className="underline hover:text-white">
                [YOUR EMAIL]
              </a>
              <span>•</span>
              <a
                href="https://github.com/[YOUR-USERNAME]"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
              >
                github.com/[YOUR-USERNAME]
              </a>
              <span>•</span>
              <a
                href="https://linkedin.com/in/[YOUR-USERNAME]"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
              >
                linkedin.com/in/[YOUR-USERNAME]
              </a>
            </div>
          </header>

          {/* Long Bio */}
          <section className="mb-14 pb-12 border-b border-white/[0.08]">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-4">
              ABOUT
            </h2>
            <div className="space-y-4 font-[family-name:var(--font-sans)] text-base text-[#edebe6]/80 leading-relaxed">
              <p>
                I&apos;m Searon, a website and app designer and frontend developer from Kathmandu, Nepal. I design interfaces from the first sketch to the final screen, then build them in code so nothing gets lost between the design and the launch.
              </p>
              <p>
                I finished my BICT degree at Asia e University in 2025, where I built a full e-commerce website as my capstone project. I have also used Blender during an internship, so I&apos;m comfortable bringing 3D into a project when it helps.
              </p>
              <p className="border border-white/10 bg-white/[0.02] p-4 font-mono text-xs text-[#edebe6]/90 rounded-sm">
                [ONE SENTENCE ABOUT YOU: what you enjoy outside work, or what drives you.]
              </p>
              <p className="border border-white/10 bg-white/[0.02] p-4 font-mono text-xs text-[#edebe6]/90 rounded-sm">
                [ONE SENTENCE ABOUT WHAT YOU WANT NEXT: for example, freelance projects, a full-time role, or an internship.]
              </p>
            </div>
          </section>

          {/* Experience */}
          <section className="mb-14 pb-12 border-b border-white/[0.08]">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-6">
              EXPERIENCE
            </h2>
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between font-mono text-xs text-[#edebe6]/50 mb-1">
                  <span>2024</span>
                  <span>[Company or organization name, Kathmandu]</span>
                </div>
                <h3 className="text-xl font-light text-[#edebe6]">
                  [INTERNSHIP / ROLE TITLE]
                </h3>
                <p className="mt-1 text-sm text-[#edebe6]/80">
                  Used Blender to build 3D models and renders.
                </p>
                <p className="mt-1 font-mono text-xs text-[#edebe6]/60">
                  [ONE SHORT LINE ON WHAT YOU DID]
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between font-mono text-xs text-[#edebe6]/50 mb-1">
                  <span>2021 — 2025</span>
                  <span>Asia e University</span>
                </div>
                <h3 className="text-xl font-light text-[#edebe6]">
                  Bachelor of Information and Communication Technology (BICT)
                </h3>
                <p className="mt-1 text-sm text-[#edebe6]/80">
                  Graduated 2025. Capstone project: designed and built a full e-commerce website.
                </p>
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="mb-14 pb-12 border-b border-white/[0.08]">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-6">
              SKILLS & DISCIPLINES
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              <div className="border border-white/10 p-5 rounded-sm">
                <span className="text-[#edebe6] font-semibold block mb-3 uppercase tracking-wider">
                  Design
                </span>
                <p className="text-[#edebe6]/75 leading-relaxed font-[family-name:var(--font-sans)] text-sm">
                  Interface design (UI), user experience (UX), responsive layouts, design systems, wireframes and prototypes, Figma.
                </p>
              </div>
              <div className="border border-white/10 p-5 rounded-sm">
                <span className="text-[#edebe6] font-semibold block mb-3 uppercase tracking-wider">
                  Code
                </span>
                <p className="text-[#edebe6]/75 leading-relaxed font-[family-name:var(--font-sans)] text-sm">
                  HTML & CSS, JavaScript, TypeScript, React, Next.js, Tailwind CSS, Git.
                </p>
              </div>
              <div className="border border-white/10 p-5 rounded-sm">
                <span className="text-[#edebe6] font-semibold block mb-3 uppercase tracking-wider">
                  3D
                </span>
                <p className="text-[#edebe6]/75 leading-relaxed font-[family-name:var(--font-sans)] text-sm">
                  Blender (modeling and rendering).
                </p>
              </div>
            </div>
          </section>

          {/* Work Process */}
          <section className="mb-8">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-4">
              PROCESS (SIX STEPS)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-3 border border-white/[0.06]">
                <span className="text-[#edebe6]/40 block mb-1">01 / LISTEN</span>
                <span className="font-[family-name:var(--font-sans)] text-xs text-[#edebe6]/80">Understand the goal and users.</span>
              </div>
              <div className="p-3 border border-white/[0.06]">
                <span className="text-[#edebe6]/40 block mb-1">02 / MAP</span>
                <span className="font-[family-name:var(--font-sans)] text-xs text-[#edebe6]/80">Plan user journeys and architecture.</span>
              </div>
              <div className="p-3 border border-white/[0.06]">
                <span className="text-[#edebe6]/40 block mb-1">03 / SKETCH</span>
                <span className="font-[family-name:var(--font-sans)] text-xs text-[#edebe6]/80">Quick wireframes and flows.</span>
              </div>
              <div className="p-3 border border-white/[0.06]">
                <span className="text-[#edebe6]/40 block mb-1">04 / DESIGN</span>
                <span className="font-[family-name:var(--font-sans)] text-xs text-[#edebe6]/80">Type, color, layout & clickable prototype.</span>
              </div>
              <div className="p-3 border border-white/[0.06]">
                <span className="text-[#edebe6]/40 block mb-1">05 / BUILD</span>
                <span className="font-[family-name:var(--font-sans)] text-xs text-[#edebe6]/80">Responsive React/Next.js/Tailwind code.</span>
              </div>
              <div className="p-3 border border-white/[0.06]">
                <span className="text-[#edebe6]/40 block mb-1">06 / TEST & SHIP</span>
                <span className="font-[family-name:var(--font-sans)] text-xs text-[#edebe6]/80">Speed, accessibility (WCAG AA), launch.</span>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
