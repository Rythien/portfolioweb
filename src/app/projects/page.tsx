"use client";

import React, { useState } from "react";
import Link from "next/link";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";
import PixelImage from "@/components/ui/PixelImage";
import { projects } from "@/content/projects";

const TYPES = ["All", "Web design", "App design", "3D / Blender"];

export default function ProjectsIndexPage() {
  const [selectedType, setSelectedType] = useState("All");

  const filtered =
    selectedType === "All"
      ? projects
      : projects.filter((p) => p.type === selectedType);

  return (
    <LenisProvider>
      <div className="min-h-screen flex flex-col justify-between">
        <Header />

        <main className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-28 sm:py-36 w-full flex-1">
          <div className="flex items-center justify-between border-b border-rule pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-ink-muted">
            <Link
              href="/"
              data-magnetic
              className="hover:text-ink flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to home</span>
            </Link>
            <span>
              {projects.length.toString().padStart(2, "0")} Projects
            </span>
          </div>

          <div className="mb-14">
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-ink tracking-tight">
              Selected Projects.
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-base sm:text-lg text-ink-muted max-w-xl">
              Case studies in website design, mobile apps, and 3D modeling from Kathmandu, Nepal.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-12 border-b border-rule pb-4 font-mono text-xs uppercase tracking-wider">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  selectedType === type
                    ? "bg-ink text-surface font-semibold"
                    : "text-ink-muted hover:text-ink border border-rule"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((project, idx) => (
              <article
                key={project.slug}
                className="border border-rule bg-ink/[0.02] p-6 rounded-sm flex flex-col justify-between hover:border-rule-hover transition-colors group"
              >
                <div>
                  <Link
                    href={`/project/${project.slug}`}
                    data-cursor="Open"
                    className="block mb-6 overflow-hidden"
                  >
                    <PixelImage
                      src={project.images[0]?.src || "/opengraph-image"}
                      alt={project.title}
                      figureNumber={`Fig. 0${idx + 1}`}
                      caption={project.subtitle}
                      aspectRatio="aspect-[16/10]"
                    />
                  </Link>

                  <div className="flex items-center justify-between font-mono text-label uppercase tracking-wider text-ink-muted mb-2 tabular-nums">
                    <span>{project.type}</span>
                    <span>{project.year}</span>
                  </div>

                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-light text-ink group-hover:text-ink transition-colors">
                    <Link href={`/project/${project.slug}`}>
                      {project.title}
                    </Link>
                  </h2>

                  <p className="mt-2 font-[family-name:var(--font-sans)] text-sm text-ink-muted leading-relaxed line-clamp-2">
                    {project.summary}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-rule flex items-center justify-between font-mono text-xs uppercase tracking-widest text-ink/80">
                  <Link
                    href={`/project/${project.slug}`}
                    data-magnetic
                    className="inline-flex items-center gap-2 hover:underline underline-offset-4"
                  >
                    <span>Read study</span>
                    <span>→</span>
                  </Link>
                  {project.placeholder && (
                    <span className="text-label text-ink-faint">
                      Pending
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
