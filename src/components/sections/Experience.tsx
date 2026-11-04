"use client";

import React from "react";
import KineticHeading from "@/components/ui/Kinetic";
import Expandable from "@/components/ui/Expandable";
import { HiddenStar } from "@/contexts/StarContext";

export default function Experience() {
  return (
    <section
      id="path"
      aria-label="Experience and education"
      className="py-24 sm:py-32 border-b border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-12 sm:mb-16">
          <div className="flex items-center gap-3 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            <span>#06 · PATH</span>
            <HiddenStar id="path-star" />
          </div>
          <span className="font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            EXPERIENCE & EDUCATION
          </span>
        </div>

        {/* Section Intro */}
        <div className="mb-14 sm:mb-20 max-w-2xl">
          <KineticHeading
            as="h2"
            className="text-h1 font-light text-[#edebe6]"
          >
            Path.
          </KineticHeading>
          <p className="mt-3 font-mono text-label uppercase tracking-widest text-[#edebe6]/75">
            Experience and education milestones.
          </p>
        </div>

        {/* Experience Entries as specified verbatim */}
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
          {/* Entry #1: 2024 Internship */}
          <div className="py-10 sm:py-12">
            <Expandable
              previewContent={
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-label uppercase tracking-wider text-[#edebe6]/75 tabular-nums">
                    <span>2024</span>
                    <span>[Company or organization name, Kathmandu]</span>
                  </div>
                  <h3 className="font-[family-name:var(--font-display)] text-h3 font-light text-[#edebe6] mt-2">
                    [INTERNSHIP / ROLE TITLE]
                  </h3>
                  <p className="font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed mt-1 max-w-[65ch] [text-wrap:pretty]">
                    Used Blender to build 3D models and renders.
                  </p>
                  <p className="font-mono text-label text-[#edebe6]/75 mt-1">
                    [One short line on what you did]
                  </p>
                </div>
              }
              expandedContent={
                <div className="font-[family-name:var(--font-sans)] text-small text-[#edebe6]/75 pt-2 space-y-1">
                  <p>• 3D modeling and rendering in Blender</p>
                  <p>• [Additional project detail or output]</p>
                </div>
              }
            />
          </div>

          {/* Entry #2: 2021 — 2025 Education & Capstone */}
          <div className="py-10 sm:py-12">
            <Expandable
              previewContent={
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-label uppercase tracking-wider text-[#edebe6]/75 tabular-nums">
                    <span>2021–2025</span>
                    <span>Asia&nbsp;e&nbsp;University</span>
                  </div>
                  <h3 className="font-[family-name:var(--font-display)] text-h3 font-light text-[#edebe6] mt-2">
                    Bachelor of Information and Communication Technology (BICT)
                  </h3>
                  <p className="font-[family-name:var(--font-sans)] text-body text-[#edebe6]/80 leading-relaxed mt-1 max-w-[65ch] [text-wrap:pretty]">
                    Graduated 2025. Capstone project: designed and built a full e-commerce website.
                  </p>
                </div>
              }
              expandedContent={
                <div className="font-[family-name:var(--font-sans)] text-small text-[#edebe6]/75 pt-2 space-y-1">
                  <p>• Full e-commerce storefront, product catalog, cart, and checkout flow</p>
                  <p>• Responsive frontend code built with React, Next.js, and Tailwind CSS</p>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
