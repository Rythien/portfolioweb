"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  DURATION,
  EASE,
  HOVER,
  SCALE,
  TILT,
  VELOCITY,
  maskImage,
  prefersReducedMotion,
  revealBlock,
} from "@/lib/motion";
import { getLenis, getVelocity } from "@/lib/scroll";
import Swap from "@/components/ui/Swap";
import { projects, type Project } from "@/content/projects";
import ProjectArt from "@/components/ui/ProjectArt";
import WorkChip from "@/components/ui/WorkChip";
import { useThemeStore } from "@/store/useThemeStore";
import { useArchiveProgress } from "@/store/useArchiveProgress";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Horizontal pan only where there is room for it and motion is welcome. */
const HORIZONTAL = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

/**
 * Tone curve for the WAKE panel art, sampled at eighths (input 0, 0.125,
 * ... 1). The covers sit almost entirely in 0.8-1.0, so the steep part is
 * up there: paper ~0.95 -> ~0.88, the title watermark ~0.87 -> ~0.73 (title vs
 * paper 20 -> ~35 levels at 1440),
 * whites stay near white; shadows below 0.75 are compressed gently.
 */
const ART_TONE = "0 0.08 0.18 0.28 0.38 0.47 0.55 0.76 0.97";

function TitleWithAccent({ project }: { project: Project }) {
  const { title, titleAccent } = project;
  if (!titleAccent) return <>{title}</>;
  const idx = title.indexOf(titleAccent);
  if (idx === -1) return <>{title}</>;
  return (
    <>
      {title.slice(0, idx)}
      <span className="accent-word">{titleAccent}</span>
      {title.slice(idx + titleAccent.length)}
    </>
  );
}

export default function Works() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const mode = useThemeStore((s) => s.mode);
  const isDream = mode === "dream";
  // Projects recovered in THE ARCHIVE carry a mark (saved across visits)
  const recovered = useArchiveProgress((s) => s.recovered);
  useEffect(() => {
    useArchiveProgress.getState().hydrate();
  }, []);

  useGSAP(
    (_ctx, contextSafe) => {
      const root = sectionRef.current;
      const pin = pinRef.current;
      const track = trackRef.current;
      if (!root || !pin || !track) return;
      const reduced = prefersReducedMotion();
      const q = (sel: string) => gsap.utils.toArray<HTMLElement>(sel, root);

      // Hover tilt, max 6deg, transforms only, mouse only; contextSafe so
      // the tweens are reverted with everything else on unmount
      const unbind: (() => void)[] = [];
      if (!reduced && contextSafe) {
        q(".work-panel-wrap").forEach((wrap) => {
          const inner = wrap.querySelector<HTMLElement>(".work-panel-tilt");
          if (!inner) return;
          const move = contextSafe((e: PointerEvent) => {
            if (e.pointerType !== "mouse") return;
            const rect = wrap.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            gsap.to(inner, {
              rotateY: nx * TILT.max * 2,
              rotateX: -ny * TILT.max * 2,
              duration: HOVER.enter,
              ease: EASE.entrance,
              overwrite: "auto",
            });
          });
          const leave = contextSafe(() => {
            gsap.to(inner, {
              rotateX: 0,
              rotateY: 0,
              duration: HOVER.leave,
              ease: EASE.entrance,
              overwrite: "auto",
            });
          });
          wrap.addEventListener("pointermove", move);
          wrap.addEventListener("pointerleave", leave);
          unbind.push(() => {
            wrap.removeEventListener("pointermove", move);
            wrap.removeEventListener("pointerleave", leave);
          });
        });
      }

      // Each project: the head rises, the panel rises, and its art is
      // uncovered inside the frame (the chip overhangs the panel, so the
      // mask goes on the art, never on the panel)
      q(".work-head").forEach((head) => revealBlock(head, { trigger: head }));
      q(".work-panel-wrap").forEach((panel) => {
        revealBlock(panel, { trigger: panel });
        maskImage(panel.querySelector(".work-frame-art"), { trigger: panel });
      });

      const mm = gsap.matchMedia();
      mm.add({ horizontal: HORIZONTAL }, (mq) => {
        if (!mq.conditions?.horizontal) {
          if (reduced) return;
          // Stacked: artwork drifts slightly inside its frame as it passes
          q(".work-art-drift").forEach((art) => {
            gsap.fromTo(
              art,
              { yPercent: -3 },
              {
                yPercent: 3,
                ease: EASE.linear,
                scrollTrigger: {
                  trigger: art.parentElement,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: DURATION.quick,
                },
              }
            );
          });
          return;
        }

        // Moment 4: pin the section and pan the three panels sideways.
        // The pan is linear so scroll and position stay 1:1; each slide
        // grows from SCALE.slideAway to 1 as it reaches the centre.
        pin.dataset.h = "";
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const pan = gsap.to(track, {
          x: () => -distance(),
          ease: EASE.linear,
          scrollTrigger: {
            trigger: pin,
            pin: true,
            start: "top top",
            end: () => "+=" + distance(),
            scrub: true,
            invalidateOnRefresh: true,
            // The pin adds scroll length: measure it before the triggers below
            refreshPriority: 1,
          },
        });
        q(".work-slide").forEach((slide) => {
          gsap.fromTo(
            slide,
            { scale: SCALE.slideAway },
            {
              scale: 1,
              ease: EASE.linear,
              scrollTrigger: {
                containerAnimation: pan,
                trigger: slide,
                start: "left right",
                end: "center center",
                scrub: true,
              },
            }
          );
        });
        // Keyboard: focus landing in an off-screen slide would make the
        // browser scroll the clipped pin sideways, fighting the pan. Undo
        // that, and instead scroll the page to where this slide is centred.
        const keepPinStill = () => {
          if (pin.scrollLeft) pin.scrollLeft = 0;
        };
        const onFocus = (e: FocusEvent) => {
          keepPinStill();
          const slide = (e.target as Element | null)?.closest<HTMLElement>(".work-slide");
          const st = pan.scrollTrigger;
          if (!slide || !st) return;
          const s = slide.getBoundingClientRect();
          const t = track.getBoundingClientRect();
          const centred = s.left - t.left + s.width / 2 - window.innerWidth / 2;
          const p = gsap.utils.clamp(0, 1, centred / Math.max(1, distance()));
          const y = st.start + p * (st.end - st.start);
          const lenis = getLenis();
          if (lenis) lenis.scrollTo(y, { immediate: true });
          else window.scrollTo(0, y);
        };
        track.addEventListener("focusin", onFocus);
        pin.addEventListener("scroll", keepPinStill);
        return () => {
          track.removeEventListener("focusin", onFocus);
          pin.removeEventListener("scroll", keepPinStill);
          delete pin.dataset.h;
        };
      });

      // The glass chips turn with scroll velocity (degrees per px scrolled,
      // either direction), on top of their slow orbit
      let stopSpin = () => {};
      if (!reduced) {
        const spins = q(".work-chip-spin").map((el) => gsap.quickSetter(el, "rotation", "deg"));
        let angle = 0;
        const tick = (_t: number, deltaMs: number) => {
          angle += getVelocity() * (deltaMs / 1000) * VELOCITY.chipDegPerPx;
          spins.forEach((set) => set(angle));
        };
        gsap.ticker.add(tick);
        stopSpin = () => gsap.ticker.remove(tick);
      }
      return () => {
        unbind.forEach((off) => off());
        stopSpin();
        mm.revert();
      };
    },
    { scope: sectionRef }
  );


  return (
    <section
      ref={sectionRef}
      id="works"
      aria-label="Selected Works"
      className="scroll-mt-24 pt-16 sm:pt-24 lg:pt-32 section-end border-t border-rule"
    >
      {/* Tone curve for the WAKE panel art (.project-art-panel): the
          generated covers are light-key (mean ~220/255, sd ~15), so the
          title watermark and glass read only at 1:1 (see ART_TONE).
          CSS contrast() would blow the light title out to white. */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id="art-tone" colorInterpolationFilters="sRGB">
          <feComponentTransfer>
            <feFuncR type="table" tableValues={ART_TONE} />
            <feFuncG type="table" tableValues={ART_TONE} />
            <feFuncB type="table" tableValues={ART_TONE} />
          </feComponentTransfer>
        </filter>
      </svg>
      {/* Pinned viewport for the horizontal pan (data-h is set by the
          script when the pan runs); otherwise a plain stacked column */}
      <div ref={pinRef} className="work-pin group/works data-[h]:h-[100dvh] data-[h]:flex data-[h]:items-center data-[h]:overflow-hidden data-[h]:pt-20">
        <div
          ref={trackRef}
          className="work-track flex flex-col gap-24 sm:gap-32 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full group-data-[h]/works:flex-row group-data-[h]/works:items-center group-data-[h]/works:w-max group-data-[h]/works:max-w-none group-data-[h]/works:mx-0 group-data-[h]/works:gap-[6vw] group-data-[h]/works:px-[calc((100vw-var(--slide-w))/2)]"
        >
          {projects.map((project, index) => (
            <article
              key={project.slug}
              className="work-slide flex flex-col gap-8 sm:gap-12 lg:grid lg:grid-cols-12 lg:gap-x-10 lg:gap-y-6 lg:items-start group-data-[h]/works:w-[var(--slide-w)] group-data-[h]/works:shrink-0"
            >
              <div className="work-head flex flex-col gap-8 sm:gap-12 lg:gap-6 lg:col-start-9 lg:col-span-4 lg:row-start-1">
                <div className="flex items-baseline justify-between border-b border-rule pb-4 font-mono text-label text-ink/80">
                  <div className="flex items-center gap-4">
                    <span className="text-ink font-medium tabular-nums">
                      {project.counter}
                    </span>
                    <span>{project.category}</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    {recovered.includes(project.slug) && (
                      <span className="inline-flex items-center gap-2 uppercase tracking-[0.12em] text-ink">
                        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5 shrink-0">
                          <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" />
                        </svg>
                        Recovered from the dream
                      </span>
                    )}
                    <span className="tabular-nums">{project.year}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <h3 className="font-[family-name:var(--font-sans)] text-h1 lg:text-h2 uppercase text-ink">
                    <Link
                      href={`/project/${project.slug}`}
                    >
                      <Swap>
                        <TitleWithAccent project={project} />
                      </Swap>
                    </Link>
                  </h3>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2 font-mono text-label text-ink/80">
                      <span>Roles:</span>
                      {project.roles.map((r, i) => (
                        <span key={r}>
                          {r}
                          {i < project.roles.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>

                    <p
                      className={`font-[family-name:var(--font-sans)] text-body leading-relaxed max-w-[60ch] [text-wrap:pretty] ${
                        isDream ? "text-ink/70 italic" : "text-ink/70"
                      }`}
                    >
                      {isDream && project.dreamDescription
                        ? project.dreamDescription
                        : project.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Panel: slides in from the right, tilts on hover, chip
                  refracts it, click opens the case study */}
              <div className="work-panel-wrap relative lg:col-span-8 lg:row-start-1 lg:row-span-2">
                <div className="work-panel-tilt relative will-change-transform">
                  {/* Frame: a 1px rule around a mat of the elevated
                      surface, the art inset in it behind a hairline */}
                  <div className="work-frame dream-glass relative p-2 sm:p-3">
                    <div className="work-frame-art relative overflow-hidden">
                      <div className="work-art-drift scale-[1.07] will-change-transform">
                        <ProjectArt
                          image={project.cover}
                          sizes="(min-width: 1280px) 1152px, (min-width: 1024px) calc(100vw - 128px), (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)"
                          loading={index === 0 ? "eager" : "lazy"}
                          className="project-art-panel"
                        />
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/project/${project.slug}`}
                    aria-label={`Open ${project.title} case study`}
                    data-cursor="View"
                    className="absolute inset-0 z-10"
                  />
                </div>
                <WorkChip project={project} />
              </div>
              <p className="-mt-4 sm:-mt-8 lg:mt-0 lg:col-span-8 lg:row-start-3 font-mono text-label text-ink/80">
                {project.cover.caption}
              </p>

              <div className="flex items-center justify-between font-mono text-label text-ink/80 lg:col-start-9 lg:col-span-4 lg:row-start-2 lg:self-end">
                <Link
                  href={`/project/${project.slug}`}
                  className="hit inline-flex items-center gap-3 text-ink underline underline-offset-4 decoration-ink/40"
                >
                  <Swap>Case Study →</Swap>
                </Link>

                {project.repo && (
                  <a
                    href={project.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hit"
                  >
                    <Swap>Source Code ↗</Swap>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
