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
      <div className="min-h-screen bg-[#050505] text-[#edebe6] flex flex-col justify-between selection:bg-[#edebe6] selection:text-[#050505]">
        <Header />

        <main className="max-w-5xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          {/* Top Bar with Back Link */}
          <div className="flex items-center justify-between border-b border-white/[0.1] pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-[#edebe6]/60">
            <Link
              href="/projects"
              data-magnetic
              className="hover:text-white flex items-center gap-2"
            >
              <span>←</span>
              <span>All Projects</span>
            </Link>
            <span>
              {project.type} · {project.year}
            </span>
          </div>

          {/* Project Title Header */}
          <header className="mb-14">
            <div className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-3">
              CASE STUDY // 0{currentIndex + 1}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-[#edebe6] tracking-tight">
              {project.title}
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-xl sm:text-2xl text-[#edebe6]/80 font-normal leading-relaxed">
              {project.subtitle}
            </p>
            {project.placeholder && (
              <div className="mt-4 inline-block font-mono text-xs text-[#edebe6]/50 border border-white/10 px-3 py-1 bg-white/[0.02]">
                [CONFIRM CASE STUDY DETAILS]
              </div>
            )}
          </header>

          {/* Hero Media Preview with Bayer Dither & Color Peek */}
          <div className="mb-16">
            <PixelImage
              src={project.images[0]?.src || "/opengraph-image"}
              alt={project.title}
              figureNumber="Fig. 01"
              caption={project.images[0]?.caption || project.subtitle}
              aspectRatio="aspect-[16/9]"
            />
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 border-b border-white/[0.08] pb-16">
            {/* Left Column: Stack & Metadata */}
            <div className="lg:col-span-4 flex flex-col gap-6 font-mono text-xs">
              <div>
                <span className="text-[#edebe6]/40 uppercase tracking-widest block mb-2">
                  Timeline
                </span>
                <span className="text-[#edebe6]">{project.year}</span>
              </div>
              <div>
                <span className="text-[#edebe6]/40 uppercase tracking-widest block mb-2">
                  Discipline
                </span>
                <span className="text-[#edebe6]">{project.type}</span>
              </div>
              <div>
                <span className="text-[#edebe6]/40 uppercase tracking-widest block mb-2">
                  Frontend Stack
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {project.stack.frontend.map((tech) => (
                    <span
                      key={tech}
                      className="border border-white/10 px-2 py-0.5 text-[#edebe6]/80"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              {project.stack.tools && (
                <div>
                  <span className="text-[#edebe6]/40 uppercase tracking-widest block mb-2">
                    Tools
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.stack.tools.map((tool) => (
                      <span
                        key={tool}
                        className="border border-white/10 px-2 py-0.5 text-[#edebe6]/80"
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
                    className="underline text-[#edebe6] hover:text-white"
                  >
                    Repository Link →
                  </a>
                </div>
              )}
            </div>

            {/* Right Column: Overview Narrative & Features */}
            <div className="lg:col-span-8 flex flex-col gap-8 font-[family-name:var(--font-sans)] text-base sm:text-lg text-[#edebe6]/80 leading-relaxed">
              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-3">
                  OVERVIEW
                </h2>
                <p>{project.overview}</p>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-3">
                  KEY FEATURES
                </h2>
                <ul className="list-disc list-inside space-y-2 text-base text-[#edebe6]/75">
                  {project.mainFeatures.map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="font-mono text-xs uppercase tracking-widest text-[#edebe6]/50 mb-3">
                  TECHNICAL CHALLENGES
                </h2>
                <ul className="list-disc list-inside space-y-2 text-base text-[#edebe6]/75">
                  {project.technicalChallenges.map((chal, idx) => (
                    <li key={idx}>{chal}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Second Image if available */}
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

          {/* Next Project Footer Link */}
          <div className="pt-12 border-t border-white/[0.1] flex items-center justify-between font-mono text-xs uppercase tracking-widest">
            <Link
              href="/projects"
              data-magnetic
              className="text-[#edebe6]/60 hover:text-white"
            >
              ← Back to all projects
            </Link>
            <Link
              href={`/project/${nextProject.slug}`}
              data-magnetic
              className="text-[#edebe6] hover:text-white flex items-center gap-2"
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
