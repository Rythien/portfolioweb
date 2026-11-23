"use client";

import React, { useRef } from "react";
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
  maskImage,
  prefersReducedMotion,
  revealBlock,
} from "@/lib/motion";
import { getLenis } from "@/lib/scroll";
import Swap from "@/components/ui/Swap";
import { projects, projectCounter, type Project } from "@/content/projects";
import ProjectVideo from "@/components/ui/ProjectVideo";
import ToolLogos from "@/components/ui/ToolLogos";
import { useThemeStore } from "@/store/useThemeStore";
import RecoveredMark from "@/components/ui/RecoveredMark";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Horizontal pan only where there is room for it and motion is welcome. */
const HORIZONTAL = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

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

        // Moment 4: pin the section and pan the panels sideways.
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

      return () => {
        unbind.forEach((off) => off());
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
      className="scroll-mt-[108px] lg:scroll-mt-24 pt-16 sm:pt-24 lg:pt-32 section-end border-t border-rule"
    >
      {/* Pinned viewport for the horizontal pan (data-h is set by the
          script when the pan runs); otherwise a plain stacked column. Its
          bottom padding centres the slide above the floating mode pill,
          not behind it */}
      <div ref={pinRef} className="work-pin group/works data-[h]:h-[100dvh] data-[h]:flex data-[h]:items-center data-[h]:overflow-hidden data-[h]:pt-20 data-[h]:pb-24">
        <div
          ref={trackRef}
          className="work-track flex flex-col gap-24 sm:gap-32 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full group-data-[h]/works:flex-row group-data-[h]/works:items-center group-data-[h]/works:w-max group-data-[h]/works:max-w-none group-data-[h]/works:mx-0 group-data-[h]/works:gap-[6vw] group-data-[h]/works:px-[calc((100vw-var(--slide-w))/2)]"
        >
          {projects.map((project) => (
            <article
              key={project.slug}
              className="work-slide flex flex-col gap-8 sm:gap-12 lg:grid lg:grid-cols-12 lg:gap-x-10 lg:gap-y-6 lg:items-start group-data-[h]/works:w-[var(--slide-w)] group-data-[h]/works:shrink-0"
            >
              <div className="work-head flex flex-col gap-8 sm:gap-12 lg:gap-6 lg:col-start-8 lg:col-span-5 wide:col-start-9 wide:col-span-4 lg:row-start-1">
                <div className="flex items-baseline justify-between border-b border-rule pb-4 font-mono text-label text-ink/80">
                  <div className="flex items-center gap-4">
                    <span className="text-ink font-medium tabular-nums">
                      {projectCounter(project)}
                    </span>
                    <span>{project.category}</span>
                  </div>
                  <div className="flex items-baseline gap-4">
                    {/* Projects recovered in THE ARCHIVE (saved across visits) */}
                    <RecoveredMark slug={project.slug} />
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

                    {/* The tools, as information beside the roles */}
                    <ToolLogos project={project} />

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
              <div className="work-panel-wrap relative lg:col-span-7 wide:col-span-8 lg:row-start-1 lg:row-span-2">
                <div className="work-panel-tilt relative will-change-transform">
                  {/* Frame: a 1px rule around a mat of the elevated
                      surface, the art inset in it behind a hairline */}
                  <div className="work-frame dream-glass relative p-2 sm:p-3">
                    <div className="work-frame-art relative overflow-hidden">
                      <div className="work-art-drift scale-[1.07] will-change-transform">
                        <ProjectVideo
                          variant="loop"
                          src={project.video.preview}
                          label={project.video.previewLabel}
                          dreamSrc={project.cover.dreamSrc}
                          sizes="(min-width: 1280px) 1152px, (min-width: 1024px) calc(100vw - 128px), (min-width: 640px) calc(100vw - 80px), calc(100vw - 48px)"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Same destination as the title: a click target only,
                      not a second tab stop or a second link to hear */}
                  <Link
                    href={`/project/${project.slug}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="absolute inset-0 z-10"
                  />
                </div>
                {/* Private builds: a recording, never a live site or a repo.
                    Plain text on purpose, nothing here is a link. It sits
                    under the panel in the panel's own column, so a long
                    description beside it can't push it down onto the pill */}
                <p className="mt-4 sm:mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-label text-ink/80">
                  <span>Video preview</span>
                  <span>Code on request</span>
                  {project.dataNote && <span>{project.dataNote}</span>}
                </p>
              </div>

              <div className="flex items-center justify-between font-mono text-label text-ink/80 lg:col-start-8 lg:col-span-5 wide:col-start-9 wide:col-span-4 lg:row-start-2 lg:self-end">
                {/* One tab stop per slide (the title link): this one and the
                    panel duplicate it */}
                <Link
                  href={`/project/${project.slug}`}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="hit inline-flex items-center gap-3 text-ink underline underline-offset-4 decoration-ink/40"
                >
                  <Swap>Case Study →</Swap>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
