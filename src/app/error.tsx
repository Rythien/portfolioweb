"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import Swap from "@/components/ui/Swap";
import Header from "@/components/common/Header";

/**
 * A route failed to render. Same paper and type as the rest of the site;
 * "Try again" re-fetches and re-renders the segment (retry), "Home" leaves.
 * Errors from the server arrive with a digest only (no message in
 * production), which is shown so a report can be matched to the logs.
 */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-16 pt-36 pb-24 flex flex-col justify-center">
      <p className="font-mono text-label text-ink-muted mb-8">Error // Something broke</p>
      <h1 className="font-[family-name:var(--font-sans)] text-h1 uppercase text-ink max-w-4xl">
        This part didn&rsquo;t <span className="accent-word">load</span>
      </h1>
      <p className="mt-8 font-[family-name:var(--font-sans)] text-body-lg text-ink/70 max-w-[52ch] [text-wrap:pretty]">
        Something went wrong while drawing this page. Trying again usually
        fixes it.
      </p>
      {digest && <p className="mt-4 font-mono text-small text-ink-muted">Reference: {digest}</p>}
      <div className="mt-14 pt-8 border-t border-rule flex flex-wrap items-center gap-x-10 gap-y-4 font-mono text-label">
        <button
          type="button"
          onClick={() => retry()}
          className="pressable hit uppercase text-ink underline underline-offset-4 decoration-ink/30"
        >
          <Swap>Try again</Swap>
        </button>
        <Link href="/" className="hit text-ink-muted">
          <Swap>← Home</Swap>
        </Link>
      </div>
    </main>
    </div>
  );
}
