import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/common/Header";
import Footer from "@/components/sections/Footer";
import LenisProvider from "@/components/common/LenisProvider";
import ProjectArt from "@/components/ui/ProjectArt";
import RecoveredMark from "@/components/ui/RecoveredMark";
import { projects, getProjectBySlug, type Project } from "@/content/projects";
import Swap from "@/components/ui/Swap";
import { pageMeta } from "@/lib/meta";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) return { title: "Case study not found" };
  return pageMeta({
    title: `${project.title}: case study`,
    description: project.summary ?? project.description,
    path: `/project/${project.slug}`,
    type: "article",
  });
}

/** A labelled block of the case study: mono label, then the prose. */
function Part({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`part-${n}`} className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-12 py-12 sm:py-16 border-t border-rule">
      <h2
        id={`part-${n}`}
        className="lg:col-span-4 font-mono text-label text-ink-muted tabular-nums"
      >
        <span className="text-ink">{n}</span>&ensp;{label}
      </h2>
      <div className="lg:col-span-8 flex flex-col gap-5 font-[family-name:var(--font-sans)] text-body-lg text-ink/80 leading-relaxed max-w-[62ch] [text-wrap:pretty]">
        {children}
      </div>
    </section>
  );
}

const paras = (list: string[]) => list.map((p, i) => <p key={i}>{p}</p>);

function StackList({ project }: { project: Project }) {
  const groups: [string, string[] | undefined][] = [
    ["Frontend", project.stack.frontend],
    ["Backend", project.stack.backend],
    ["Tools", project.stack.tools],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-8">
      {groups
        .filter(([, items]) => items && items.length > 0)
        .map(([label, items]) => (
          <div key={label}>
            <dt className="font-mono text-label text-ink-muted mb-3">{label}</dt>
            <dd>
              <ul className="flex flex-col gap-1.5 text-body text-ink">
                {items!.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
    </dl>
  );
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
  const cs = project.caseStudy;

  return (
    <LenisProvider>
      <div className="min-h-screen flex flex-col justify-between">
        <Header />

        <main className="max-w-5xl mx-auto px-6 sm:px-10 py-28 sm:py-36 w-full flex-1">
          <div className="flex items-center justify-between border-b border-rule pb-6 mb-12 font-mono text-xs uppercase tracking-widest text-ink-muted">
            <Link
              href="/projects"
              className="hit flex items-center gap-2"
            >
              <Swap>← All Projects</Swap>
            </Link>
            <span>
              {project.type} · {project.year}
            </span>
          </div>

          <header className="mb-14">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 font-mono text-label text-ink-muted mb-3">
              <span>Case Study // 0{currentIndex + 1}</span>
              <RecoveredMark slug={project.slug} />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-7xl font-light text-ink tracking-tight">
              {project.title}
            </h1>
            <p className="mt-4 font-[family-name:var(--font-sans)] text-xl sm:text-2xl text-ink/80 font-normal leading-relaxed">
              {project.subtitle}
            </p>
            {!cs && project.placeholder && (
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
            <figcaption className="font-[family-name:var(--font-sans)] text-small text-ink/80 leading-relaxed [text-wrap:pretty]">
              <span className="font-mono text-label text-ink tabular-nums mr-2">Fig. 01</span>
              {project.cover.caption}
            </figcaption>
          </figure>

          {/* At a glance */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 pb-12 font-mono text-label">
            <div>
              <dt className="text-ink-muted mb-2">Year</dt>
              <dd className="text-ink">{project.year}</dd>
            </div>
            <div>
              <dt className="text-ink-muted mb-2">Discipline</dt>
              <dd className="text-ink">{project.type}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-muted mb-2">Role</dt>
              <dd className="text-ink">{project.roles.join(" · ")}</dd>
            </div>
          </dl>

          {cs ? (
            <article aria-label={`${project.title} case study`}>
              <Part n="01" label="The problem">{paras(cs.problem)}</Part>
              <Part n="02" label="My role">{paras(cs.role)}</Part>
              <Part n="03" label="Approach">{paras(cs.approach)}</Part>
              <Part n="04" label="Decisions">
                <ol className="flex flex-col gap-10">
                  {cs.decisions.map((d, i) => (
                    <li key={d.title} className="flex flex-col gap-3">
                      <h3 className="font-[family-name:var(--font-sans)] text-h3 text-ink">
                        <span className="font-mono text-label text-ink-muted tabular-nums mr-3">
                          {String.fromCharCode(97 + i)}.
                        </span>
                        {d.title}
                      </h3>
                      {paras(d.body)}
                    </li>
                  ))}
                </ol>
              </Part>
              {cs.outcome && cs.outcome.length > 0 && (
                <Part n="05" label="Outcome">{paras(cs.outcome)}</Part>
              )}
              <Part n={cs.outcome?.length ? "06" : "05"} label="What I'd do differently">
                {paras(cs.differently)}
              </Part>
              <Part n={cs.outcome?.length ? "07" : "06"} label="Stack">
                <StackList project={project} />
              </Part>
            </article>
          ) : (
            // No written case study yet: the short account and the stack
            <article aria-label={`${project.title} overview`}>
              <Part n="01" label="Overview">
                <p>{project.overview}</p>
              </Part>
              {project.mainFeatures && project.mainFeatures.length > 0 && (
                <Part n="02" label="Key features">
                  <ul className="list-disc pl-5 space-y-2">
                    {project.mainFeatures.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </Part>
              )}
              {project.technicalChallenges && project.technicalChallenges.length > 0 && (
                <Part n="03" label="Technical challenges">
                  <ul className="list-disc pl-5 space-y-2">
                    {project.technicalChallenges.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </Part>
              )}
              <Part n="04" label="Stack">
                <StackList project={project} />
              </Part>
            </article>
          )}

          {project.images.length > 0 && (
            <section aria-labelledby="gallery" className="pt-12 sm:pt-16 mb-16 border-t border-rule">
              <h2 id="gallery" className="font-mono text-label text-ink-muted mb-8">
                Gallery
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12">
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
                    <figcaption className="font-[family-name:var(--font-sans)] text-small text-ink/80 leading-relaxed [text-wrap:pretty]">
                      <span className="font-mono text-label text-ink tabular-nums mr-2">
                        Fig. 0{i + 2}
                      </span>
                      {image.caption}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <div className="pt-12 border-t border-rule flex flex-wrap gap-y-4 items-center justify-between font-mono text-xs uppercase tracking-widest">
            <Link
              href="/projects"
              className="hit text-ink-muted"
            >
              <Swap>← Back to all projects</Swap>
            </Link>
            <Link
              href={`/project/${nextProject.slug}`}
              className="hit text-ink flex items-center gap-2"
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
