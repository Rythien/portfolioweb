import React from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Excerpt } from "@/content/projects";

/*
 * A short excerpt from a private repository, read at build time from
 * src/content/excerpts/ (copied verbatim from the source; "// …" lines
 * mark what was left out). Highlighting is a small tokenizer rather than
 * a dependency: comments, strings, keywords and numbers are all these
 * excerpts need, and the colours come from the theme (.tok-* in
 * globals.css), so they follow WAKE and DREAM.
 */

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|\b(const|let|var|function|return|if|else|for|while|await|async|new|export|import|from|of|in|typeof|true|false|null|undefined|type)\b|\b(\d+(?:\.\d+)?)\b/g;

const CLASS = ["", "tok-c", "tok-s", "tok-k", "tok-n"];

function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(code.slice(last, at));
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    out.push(
      <span key={at} className={CLASS[group]}>
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

/** Read at build: cached, so prerendering never waits on the file system. */
async function readExcerpt(source: string) {
  "use cache";
  const text = await readFile(join(process.cwd(), "src", "content", "excerpts", source), "utf8");
  return text.replace(/\r\n/g, "\n").trimEnd();
}

export default async function CodeExcerpt({ excerpt, n }: { excerpt: Excerpt; n: number }) {
  const code = await readExcerpt(excerpt.source);
  return (
    <figure className="flex flex-col gap-3">
      <div className="border border-rule rounded-sm bg-surface-elevated">
        <div className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2 font-mono text-label text-ink/80">
          <span className="normal-case tracking-normal">{excerpt.file}</span>
          <span className="tabular-nums">{String(n).padStart(2, "0")}</span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.875rem] leading-relaxed text-ink" tabIndex={0}>
          <code>{highlight(code)}</code>
        </pre>
      </div>
      <figcaption className="font-[family-name:var(--font-sans)] text-small text-ink/80 leading-relaxed [text-wrap:pretty]">
        {excerpt.why}
      </figcaption>
    </figure>
  );
}
