"use client";

import React, { useState } from "react";
import Link from "next/link";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";
import ProjectArt from "@/components/ui/ProjectArt";
import { projects } from "@/content/projects";
import Swap from "@/components/ui/Swap";

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
              className="hit flex items-center gap-2"
            >
              <Swap>← Back to home</Swap>
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
                className={`pressable px-3 py-1.5 rounded-sm ${
                  selectedType === type
                    ? "bg-ink text-surface font-semibold"
                    : "text-ink-muted border border-rule"
                }`}
              >
                <Swap>{type}</Swap>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((project, idx) => (
              <article
                key={project.slug}
                className="border border-rule bg-ink/[0.02] p-6 rounded-sm flex flex-col justify-between"
              >
                <div>
                  <Link
                    href={`/project/${project.slug}`}
                    data-cursor="View"
                    className="block mb-6 overflow-hidden"
                  >
                    <figure className="flex flex-col gap-2">
                      <ProjectArt
                        image={project.cover}
                        sizes="(min-width: 1280px) 336px, (min-width: 1024px) calc(33vw - 90px), (min-width: 768px) calc(50vw - 92px), calc(100vw - 96px)"
                        loading={idx === 0 ? "eager" : "lazy"}
                        className="border border-rule rounded-sm"
                      />
                      <figcaption className="font-mono text-label uppercase tracking-wider text-ink/80">
                        {project.cover.caption}
                      </figcaption>
                    </figure>
                  </Link>

                  <div className="flex items-center justify-between font-mono text-label uppercase tracking-wider text-ink-muted mb-2 tabular-nums">
                    <span>{project.type}</span>
                    <span>{project.year}</span>
                  </div>

                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-light text-ink">
                    <Link href={`/project/${project.slug}`} className="hit">
                      <Swap>{project.title}</Swap>
                    </Link>
                  </h2>

                  <p className="mt-2 font-[family-name:var(--font-sans)] text-sm text-ink-muted leading-relaxed line-clamp-2">
                    {project.summary}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-rule flex items-center justify-between font-mono text-xs uppercase tracking-widest text-ink/80">
                  <Link
                    href={`/project/${project.slug}`}
                    className="hit inline-flex items-center gap-2"
                  >
                    <Swap>Read study →</Swap>
                  </Link>
                  {project.placeholder && (
                    <span className="text-label text-ink-muted">
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
