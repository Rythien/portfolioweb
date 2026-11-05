import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";
import PixelImage from "@/components/ui/PixelImage";
import { projects, getProjectBySlug } from "@/content/projects";

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
              data-magnetic
              className="hover:text-ink flex items-center gap-2"
            >
              <span>←</span>
              <span>All Projects</span>
            </Link>
            <span>
              {project.type} · {project.year}
            </span>
          </div>

          <header className="mb-14">
            <div className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-3">
              Case Study // 0{currentIndex + 1}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-ink tracking-tight">
              {project.title}
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-xl sm:text-2xl text-ink/80 font-normal leading-relaxed">
              {project.subtitle}
            </p>
            {project.placeholder && (
              <div className="mt-4 inline-block font-mono text-xs text-ink-faint border border-rule px-3 py-1 bg-ink/[0.02]">
                Details pending
              </div>
            )}
          </header>

          <div className="mb-16">
            <PixelImage
              src={project.images[0]?.src || "/opengraph-image"}
              alt={project.title}
              figureNumber="Fig. 01"
              caption={project.images[0]?.caption || project.subtitle}
              aspectRatio="aspect-[16/9]"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 border-b border-rule pb-16">
            <div className="lg:col-span-4 flex flex-col gap-6 font-mono text-xs">
              <div>
                <span className="text-ink-faint uppercase tracking-widest block mb-2">
                  Timeline
                </span>
                <span className="text-ink">{project.year}</span>
              </div>
              <div>
                <span className="text-ink-faint uppercase tracking-widest block mb-2">
                  Discipline
                </span>
                <span className="text-ink">{project.type}</span>
              </div>
              <div>
                <span className="text-ink-faint uppercase tracking-widest block mb-2">
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
                  <span className="text-ink-faint uppercase tracking-widest block mb-2">
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
                    className="underline text-ink hover:text-ink"
                  >
                    Repository Link →
                  </a>
                </div>
              )}
            </div>

            <div className="lg:col-span-8 flex flex-col gap-8 font-[family-name:var(--font-sans)] text-base sm:text-lg text-ink-muted leading-relaxed">
              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-3">
                  Overview
                </h2>
                <p>{project.overview}</p>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-3">
                  Key Features
                </h2>
                <ul className="list-disc list-inside space-y-2 text-base text-ink/75">
                  {project.mainFeatures?.map((feat: string, idx: number) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-ink-faint mb-3">
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

          {project.images[1] && (
            <div className="mb-16">
              <PixelImage
                src={project.images[1].src}
                alt={project.images[1].alt}
                figureNumber="Fig. 02"
                caption={project.images[1].caption}
                aspectRatio="aspect-[16/10]"
              />
            </div>
          )}

          <div className="pt-12 border-t border-rule flex items-center justify-between font-mono text-xs uppercase tracking-widest">
            <Link
              href="/projects"
              data-magnetic
              className="text-ink-muted hover:text-ink"
            >
              ← Back to all projects
            </Link>
            <Link
              href={`/project/${nextProject.slug}`}
              data-magnetic
              className="text-ink hover:text-ink flex items-center gap-2"
            >
              <span>Next: {nextProject.title}</span>
              <span>→</span>
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </LenisProvider>
  );
}
