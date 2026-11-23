import React from "react";
import {
  siReact,
  siNextdotjs,
  siTailwindcss,
  siTypescript,
  siNodedotjs,
  siMongodb,
  siFigma,
  siGit,
  siBlender,
  siFramer,
  siJavascript,
  siGsap,
  siSqlite,
  siThreedotjs,
  siVite,
  siReactrouter,
  siAstro,
} from "simple-icons";
import type { Project } from "@/content/projects";

const ICONS: Record<string, { path: string; title: string }> = {
  React: siReact,
  "Next.js": siNextdotjs,
  "Tailwind CSS": siTailwindcss,
  TypeScript: siTypescript,
  "Node.js": siNodedotjs,
  MongoDB: siMongodb,
  Figma: siFigma,
  Git: siGit,
  Blender: siBlender,
  "Framer Motion": siFramer,
  JavaScript: siJavascript,
  GSAP: siGsap,
  SQLite: siSqlite,
  "Three.js": siThreedotjs,
  Vite: siVite,
  "React Router": siReactrouter,
  Astro: siAstro,
};

/** The project's tools that have a logo, in stack order, each once. */
function toolsOf(project: Project) {
  const names = [
    ...project.stack.frontend,
    ...(project.stack.backend ?? []),
    ...(project.stack.tools ?? []),
  ];
  const seen = new Set<string>();
  return names.flatMap((name) => {
    const icon = ICONS[name];
    if (!icon || seen.has(icon.title)) return [];
    seen.add(icon.title);
    return [icon];
  });
}

/**
 * The tools a project was made with, as flat logos beside its roles:
 * information, so they sit in the text column at text size, in the ink
 * colour, each named for screen readers and on hover.
 */
export default function ToolLogos({ project }: { project: Project }) {
  const tools = toolsOf(project);
  if (!tools.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 font-mono text-label text-ink/80">
      <span>Tools:</span>
      <ul className="flex flex-wrap items-center gap-4" aria-label="Tools">
        {tools.map((t) => (
          <li key={t.title} title={t.title} className="flex">
            <svg viewBox="0 0 24 24" width="20" height="20" role="img" aria-label={t.title} className="fill-ink">
              <path d={t.path} />
            </svg>
          </li>
        ))}
      </ul>
    </div>
  );
}
