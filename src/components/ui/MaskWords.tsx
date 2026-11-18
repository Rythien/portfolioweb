"use client";

import React, { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { revealWords } from "@/lib/motion";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface StatementPart {
  text: string;
  /** The statement's one Newsreader italic word. */
  accent?: boolean;
}

interface MaskWordsProps {
  parts: StatementPart[];
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  id?: string;
}

/**
 * Moment 2: a big statement that reveals word by word, each word rising
 * from below its own mask when the statement crosses 75% of the viewport
 * (TRIGGER). The mask is overflow: clip (not hidden), so each word keeps
 * its own text baseline and the accent word sits on the line correctly.
 * Reduced motion: the words fade in.
 */
export default function MaskWords({ parts, as: Tag = "p", className = "", id }: MaskWordsProps) {
  const ref = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      revealWords(gsap.utils.toArray<HTMLElement>("[data-word]", el), { trigger: el });
    },
    { scope: ref }
  );

  const words = parts.flatMap((part, p) =>
    part.text
      .split(/\s+/)
      .filter(Boolean)
      .map((word, w) => ({ key: `${p}-${w}`, word, accent: !!part.accent }))
  );

  return (
    <Tag ref={ref as React.Ref<never>} id={id} className={className}>
      {words.map(({ key, word, accent }, i) => (
        <React.Fragment key={key}>
          {i > 0 && " "}
          <span className="inline-block overflow-clip pr-[0.08em] -mr-[0.08em]">
            <span data-word className={`inline-block ${accent ? "accent-word" : ""}`}>
              {word}
            </span>
          </span>
        </React.Fragment>
      ))}
    </Tag>
  );
}
