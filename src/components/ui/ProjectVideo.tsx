"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useArchiveStore } from "@/store/useArchiveStore";

interface ProjectVideoProps {
  /** Path without extension: <src>.webm, <src>.mp4, <src>-poster.webp. */
  src: string;
  /** What the clip shows, for screen readers. */
  label: string;
  /** DREAM cover, crossfaded over the clip by the --dream flood value. */
  dreamSrc?: string;
  /** Rendered width at each breakpoint, for the DREAM cover's srcset. */
  sizes: string;
  /** Loop silently while on screen (panels), or play with controls (case study). */
  variant: "loop" | "player";
  className?: string;
}

/**
 * A 16:10 screen recording. The loop variant plays muted only while at
 * least a third of it is on screen, never while THE ARCHIVE covers the
 * page, and not at all under reduced motion (the poster stays). Nothing
 * is fetched until it first comes into view.
 */
export default function ProjectVideo({ src, label, dreamSrc, sizes, variant, className = "" }: ProjectVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const archiveOpen = useArchiveStore((s) => s.open);

  useEffect(() => {
    const video = ref.current;
    if (!video || variant !== "loop") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let run = false;
    const sync = () => {
      run = visible && !reduced.matches && !archiveOpen && !document.hidden;
      if (run) {
        if (video.preload === "none") video.preload = "auto";
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    };
    // The Works pin re-parents the section on every ScrollTrigger refresh,
    // and a media element moved in the DOM is paused by the browser without
    // a pause() call or a new intersection: pick it back up.
    let raf = 0;
    const onPause = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (run && video.paused && video.isConnected) video.play().catch(() => {});
      });
    };
    video.addEventListener("pause", onPause);
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.33 },
    );
    io.observe(video);
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("pause", onPause);
      io.disconnect();
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [variant, archiveOpen]);

  const loop = variant === "loop";
  return (
    <div className={`relative w-full aspect-[16/10] overflow-hidden bg-surface-elevated ${className}`}>
      {/* suppressHydrationWarning: browser extensions inject data-vc-*
          attributes into <video> before hydration. It covers this element's
          own attributes only, not its children. */}
      <video
        ref={ref}
        suppressHydrationWarning
        className="absolute inset-0 h-full w-full object-cover"
        poster={`${src}-poster.webp`}
        preload="none"
        muted={loop}
        loop={loop}
        playsInline
        controls={!loop}
        aria-label={label}
      >
        {/* H.264 first: Edge on Windows reports it can play the VP9 WebM,
            picks it, and then sits on the first frame */}
        <source src={`${src}.mp4`} type="video/mp4" />
        <source src={`${src}.webm`} type="video/webm" />
      </video>
      {dreamSrc && (
        <Image
          src={dreamSrc}
          alt=""
          aria-hidden="true"
          fill
          sizes={sizes}
          className="object-cover project-art-dream pointer-events-none"
        />
      )}
    </div>
  );
}
