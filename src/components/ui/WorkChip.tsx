"use client";

import React, { useMemo } from "react";
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
} from "simple-icons";
import type { Project } from "@/content/projects";

const ICON_MAP: Record<string, { path: string; title: string }> = {
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
};

const MAX_ICONS = 6;

/**
 * Frosted glass disc overlapping a work panel's edge, carrying the
 * project's tool logos on a slow orbit. The backdrop blur refracts
 * the panel behind it; hovering the panel deepens the refraction.
 */
export default function WorkChip({ project }: { project: Project }) {
  const icons = useMemo(() => {
    const names = [
      ...project.stack.frontend,
      ...(project.stack.backend ?? []),
      ...(project.stack.tools ?? []),
    ];
    const seen = new Set<string>();
    const out: { path: string; title: string }[] = [];
    for (const name of names) {
      const icon = ICON_MAP[name];
      if (icon && !seen.has(icon.title)) {
        seen.add(icon.title);
        out.push(icon);
        if (out.length === MAX_ICONS) break;
      }
    }
    return out;
  }, [project]);

  if (!icons.length) return null;

  return (
    <div
      aria-hidden="true"
      className="work-chip hidden sm:flex absolute -top-8 -right-4 lg:-right-8 w-28 h-28 lg:w-32 lg:h-32 rounded-full items-center justify-center pointer-events-none select-none"
    >
      <div className="work-chip-orbit absolute inset-0">
        {icons.map((icon, i) => (
          <span
            key={icon.title}
            className="work-chip-item absolute left-1/2 top-1/2 w-5 h-5 -ml-2.5 -mt-2.5"
            style={
              {
                "--angle": `${Math.round((360 / icons.length) * i)}deg`,
              } as React.CSSProperties
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="work-chip-logo w-full h-full fill-ink/80"
            >
              <title>{icon.title}</title>
              <path d={icon.path} />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
