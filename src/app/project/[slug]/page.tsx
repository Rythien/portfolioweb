import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";
import ProjectArt from "@/components/ui/ProjectArt";
import { projects, getProjectBySlug } from "@/content/projects";
import Swap from "@/components/ui/Swap";

// main is max-w-5xl (1024px) with px-6 / sm:px-10 gutters
const CASE_STUDY_FULL =
  "(min-width: 1104px) 1024px, (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)";
const CASE_STUDY_HALF =
  "(min-width: 1104px) 496px, (min-width: 640px) calc(50vw - 56px), calc(100vw - 48px)";

export function generateStaticParams() {
  return projects.map((p) => ({
    slug: p.slug,
  }));
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const currentIndex = projects.findIndex((p) => p.slug === slug);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <LenisProvider>
      <div className="min-h-screen flex flex-col justify-between">
        <Header />

        <main className="max-w-5xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          <div className="flex items-center justify-between border-b border-rule pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-ink-muted">
            <Link
              href="/projects"
              className="flex items-center gap-2"
            >
              <Swap>← All Projects</Swap>
            </Link>
            <span>
              {project.type} · {project.year}
            </span>
          </div>

          <header className="mb-14">
            <div className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3">
              Case Study // 0{currentIndex + 1}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-ink tracking-tight">
              {project.title}
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-xl sm:text-2xl text-ink/80 font-normal leading-relaxed">
              {project.subtitle}
            </p>
            {project.placeholder && (
              <div className="mt-4 inline-block font-mono text-xs text-ink-muted border border-rule px-3 py-1 bg-ink/[0.02]">
                Details pending
              </div>
            )}
          </header>

          <figure className="mb-16 flex flex-col gap-3">
            <ProjectArt
              image={project.cover}
              sizes={CASE_STUDY_FULL}
              lcp
              className="border border-rule rounded-sm"
            />
            <figcaption className="font-mono text-label uppercase tracking-wider text-ink/80 tabular-nums">
              Fig. 01 · {project.cover.caption}
            </figcaption>
          </figure>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 border-b border-rule pb-16">
            <div className="lg:col-span-4 flex flex-col gap-6 font-mono text-xs">
              <div>
                <span className="text-ink-muted uppercase tracking-widest block mb-2">
                  Timeline
                </span>
                <span className="text-ink">{project.year}</span>
              </div>
              <div>
                <span className="text-ink-muted uppercase tracking-widest block mb-2">
                  Discipline
                </span>
                <span className="text-ink">{project.type}</span>
              </div>
              <div>
                <span className="text-ink-muted uppercase tracking-widest block mb-2">
                  Frontend Stack
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {project.stack.frontend.map((tech) => (
                    <span
                      key={tech}
                      className="border border-rule px-2 py-0.5 text-ink/80"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              {project.stack.tools && (
                <div>
                  <span className="text-ink-muted uppercase tracking-widest block mb-2">
                    Tools
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.stack.tools.map((tool) => (
                      <span
                        key={tool}
                        className="border border-rule px-2 py-0.5 text-ink/80"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {project.links?.repo && (
                <div className="pt-2">
                  <a
                    href={project.links.repo}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-ink"
                  >
                    <Swap>Repository Link →</Swap>
                  </a>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 flex flex-col gap-8 font-[family-name:var(--font-sans)] text-base sm:text-lg text-ink-muted leading-relaxed">
              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3">
                  Overview
                </h2>
                <p>{project.overview}</p>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3">
                  Key Features
                </h2>
                <ul className="list-disc list-inside space-y-2 text-base text-ink/75">
                  {project.mainFeatures?.map((feat: string, idx: number) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted mb-3">
                  Technical Challenges
                </h2>
                <ul className="list-disc list-inside space-y-2 text-base text-ink/75">
                  {project.technicalChallenges?.map((chal: string, idx: number) => (
                    <li key={idx}>{chal}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {project.images.length > 0 && (
            <section aria-label="Gallery" className="mb-16 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              {project.images.map((image, i) => (
                <figure
                  key={image.src}
                  className={`flex flex-col gap-3 ${i === 0 ? "sm:col-span-2" : ""}`}
                >
                  <ProjectArt
                    image={image}
                    sizes={i === 0 ? CASE_STUDY_FULL : CASE_STUDY_HALF}
                    className="border border-rule rounded-sm"
                  />
                  <figcaption className="font-mono text-label uppercase tracking-wider text-ink/80 tabular-nums">
                    Fig. 0{i + 2} · {image.caption}
                  </figcaption>
                </figure>
              ))}
            </section>
          )}

          <div className="pt-12 border-t border-rule flex items-center justify-between font-mono text-xs uppercase tracking-widest">
            <Link
              href="/projects"
              className="text-ink-muted"
            >
              <Swap>← Back to all projects</Swap>
            </Link>
            <Link
              href={`/project/${nextProject.slug}`}
              className="text-ink flex items-center gap-2"
            >
              <Swap>Next: {nextProject.title} →</Swap>
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
