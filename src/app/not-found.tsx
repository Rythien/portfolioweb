import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/common/Header";
import Swap from "@/components/ui/Swap";

export const metadata: Metadata = {
  title: "Page not found",
  description: "There is nothing at this address.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-16 pt-36 pb-24 flex flex-col justify-center">
        <p className="font-mono text-label text-ink-muted tabular-nums mb-8">404 // Not found</p>
        <h1 className="font-[family-name:var(--font-sans)] text-h1 uppercase text-ink max-w-4xl">
          This page drifted <span className="accent-word">off</span>
        </h1>
        <p className="mt-8 font-[family-name:var(--font-sans)] text-body-lg text-ink/70 max-w-[52ch] [text-wrap:pretty]">
          Nothing lives at this address. It may have moved, or the link was
          mistyped.
        </p>
        <nav aria-label="Where to go" className="mt-14 pt-8 border-t border-rule flex flex-wrap gap-x-10 gap-y-4 font-mono text-label">
          <Link href="/" className="hit text-ink underline underline-offset-4 decoration-ink/30">
            <Swap>← Home</Swap>
          </Link>
          <Link href="/projects" className="hit text-ink-muted">
            <Swap>All projects →</Swap>
          </Link>
        </nav>
      </main>
    </div>
  );
}
