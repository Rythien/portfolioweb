"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  DURATION,
  EASE,
  FEEDBACK,
  HOVER,
  MAGNET,
  SCALE,
  magnetRelease,
  magnetTo,
} from "@/lib/motion";
import { useFractureStore } from "@/store/useFractureStore";

/** Scene labels the WebGL layer reports through the fracture store. */
const SCENE_LABELS = new Set(["BREAK", "ENTER"]);
/** The dot's size over a link or button, as a scale of its rest size. */
const DOT_OVER_INTERACTIVE = 1.8;
/** How close (px) the dot must render to the real pointer to count as working. */
const DOT_PROOF_PX = 4;

const ENTER = { duration: HOVER.enter, ease: EASE.entrance } as const;
const LEAVE = { duration: HOVER.leave, ease: EASE.entrance } as const;

/**
 * The site cursor (fine pointers, motion allowed). Three states:
 *   default   a dot that follows the pointer
 *   BREAK     over the crystal      (scene: CrystalHover)
 *   ENTER     over the brush blob   (scene: Compositor)
 * Project panels carry no label: they read as clickable on their own.
 * A DOM element can still ask for one with data-cursor (the /journey
 * globe's DRAG).
 * A labelled state opens a ring and the label rises in through a clip;
 * leaving runs at 60% of the enter. Links and buttons grow the dot.
 *
 * It also drives the magnetic field: every [data-magnetic] element within
 * MAGNET.radius px of the pointer leans toward it (max MAGNET.max px) and
 * springs home when the pointer moves away. Inside a [data-magnet-group]
 * (the header nav) the fields overlap, so only the nearest member leans.
 */
export default function CustomCursor() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = rootRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const label = labelRef.current;
    if (!fine || reduced || !root || !dot || !ring || !label) return;

    // Safeguard: the native pointer is only hidden (has-custom-cursor) once
    // the dot has been seen rendering under the real pointer. An error in
    // setup, or a dot that does not show up, leaves the native pointer on.
    let ctx: gsap.Context | null = null;
    let failed = false;
    const giveUp = (why: unknown) => {
      if (failed) return;
      failed = true;
      document.body.classList.remove("has-custom-cursor");
      try {
        ctx?.revert();
      } catch {
        // already torn down
      }
      gsap.set(root, { autoAlpha: 0 });
      console.warn("Custom cursor disabled, native pointer restored:", why);
    };

    const setup = () => gsap.context(() => {
      gsap.set([dot, ring], { xPercent: -50, yPercent: -50, x: -100, y: -100 });
      gsap.set(ring, { scale: 0, autoAlpha: 0 });
      gsap.set(label, { yPercent: 100 });
      gsap.set(root, { autoAlpha: 0 });

      // The dot is glued to the pointer; the ring trails it a little
      const dotFollow = { duration: FEEDBACK.pointer, ease: EASE.entrance };
      const ringFollow = { duration: DURATION.quick, ease: EASE.entrance };
      const xDot = gsap.quickTo(dot, "x", dotFollow);
      const yDot = gsap.quickTo(dot, "y", dotFollow);
      const xRing = gsap.quickTo(ring, "x", ringFollow);
      const yRing = gsap.quickTo(ring, "y", ringFollow);

      /* ── Labels ──────────────────────────────────────────────── */

      let shown = "";
      let domLabel = "";
      let overInteractive = false;
      let labelTl: gsap.core.Timeline | null = null;

      const show = (next: string) => {
        if (next === shown) return;
        const prev = shown;
        shown = next;
        labelTl?.kill();
        labelTl = gsap.timeline();
        if (prev) {
          // The old label leaves upward through the clip
          labelTl.to(label, { yPercent: -100, ...LEAVE });
        }
        if (next) {
          labelTl
            .call(() => {
              label.textContent = next;
            })
            .set(label, { yPercent: 100 })
            .to(ring, { scale: 1, autoAlpha: 1, ...ENTER }, prev ? ">" : 0)
            .to(dot, { scale: 0, ...ENTER }, "<")
            .to(label, { yPercent: 0, ...ENTER }, "<");
        } else {
          labelTl
            .to(ring, { scale: 0, autoAlpha: 0, ...LEAVE }, 0)
            .to(dot, { scale: overInteractive ? DOT_OVER_INTERACTIVE : 1, ...LEAVE }, 0);
        }
      };

      // DOM labels win; the scene's only show where no control is under the pointer
      const resolve = () => {
        const scene = useFractureStore.getState().cursorLabel;
        show(domLabel || (!overInteractive && SCENE_LABELS.has(scene) ? scene : ""));
      };

      const unsubscribe = useFractureStore.subscribe((s, p) => {
        if (s.cursorLabel !== p.cursorLabel) resolve();
      });

      /* ── Magnetic field ──────────────────────────────────────── */

      const pulled = new Set<HTMLElement>();
      const field = (mx: number, my: number) => {
        // Measure every magnet at rest (minus the pull already applied)
        const hits: { el: HTMLElement; edge: number; dx: number; dy: number; group: Element | null }[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("[data-magnetic]")) {
          const r = el.getBoundingClientRect();
          const ox = Number(gsap.getProperty(el, "x")) || 0;
          const oy = Number(gsap.getProperty(el, "y")) || 0;
          const left = r.left - ox;
          const top = r.top - oy;
          const right = left + r.width;
          const bottom = top + r.height;
          const ex = Math.max(left - mx, 0, mx - right);
          const ey = Math.max(top - my, 0, my - bottom);
          hits.push({
            el,
            edge: Math.hypot(ex, ey),
            dx: mx - (left + right) / 2,
            dy: my - (top + bottom) / 2,
            group: el.closest("[data-magnet-group]"),
          });
        }
        // Inside a group (the nav), fields overlap: only the nearest leans
        const nearest = new Map<Element, (typeof hits)[number]>();
        for (const h of hits) {
          if (!h.group) continue;
          const best = nearest.get(h.group);
          if (!best || h.edge < best.edge) nearest.set(h.group, h);
        }
        for (const h of hits) {
          const active = h.edge < MAGNET.radius && (!h.group || nearest.get(h.group) === h);
          if (active) {
            magnetTo(h.el, h.dx, h.dy, h.edge);
            pulled.add(h.el);
          } else if (pulled.has(h.el)) {
            magnetRelease(h.el);
            pulled.delete(h.el);
          }
        }
      };
      const releaseAll = () => {
        pulled.forEach((el) => magnetRelease(el));
        pulled.clear();
      };

      // Press on magnetic controls: GSAP owns their transform (and writes
      // an inline scale: none with it), so the CSS .pressable scale cannot
      // reach them; press them here instead
      const PRESS = { duration: FEEDBACK.press, ease: EASE.entrance } as const;
      let pressed: HTMLElement | null = null;
      const onDown = (e: PointerEvent) => {
        pressed = (e.target as Element | null)?.closest<HTMLElement>("[data-magnetic].pressable") ?? null;
        if (pressed) gsap.to(pressed, { scale: SCALE.press, ...PRESS });
      };
      const onUp = () => {
        if (pressed) gsap.to(pressed, { scale: 1, ...PRESS });
        pressed = null;
      };

      /* ── Pointer ─────────────────────────────────────────────── */

      let visible = false;
      let proven = false;
      // Two frames after the first move: is the dot really drawn where the
      // pointer is? Only then is the native pointer hidden.
      const prove = (x: number, y: number) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (failed) return;
            const r = dot.getBoundingClientRect();
            const drawn =
              getComputedStyle(root).display !== "none" &&
              getComputedStyle(dot).display !== "none" &&
              r.width > 0 &&
              Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) < DOT_PROOF_PX;
            if (drawn) {
              proven = true;
              document.body.classList.add("has-custom-cursor");
            } else {
              giveUp("the dot did not render under the pointer");
            }
          })
        );
      };
      const onMove = (e: MouseEvent) => {
        if (!visible) {
          visible = true;
          gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
          gsap.to(root, { autoAlpha: 1, ...ENTER });
          if (!proven) prove(e.clientX, e.clientY);
        }
        xDot(e.clientX);
        yDot(e.clientY);
        xRing(e.clientX);
        yRing(e.clientY);
        field(e.clientX, e.clientY);
      };

      const onOver = (e: MouseEvent) => {
        const t = e.target as HTMLElement | null;
        if (!t) return;
        domLabel = t.closest<HTMLElement>("[data-cursor]")?.dataset.cursor?.toUpperCase() ?? "";
        const interactive = !!t.closest("a, button, [role='button'], label, summary");
        if (interactive !== overInteractive) {
          overInteractive = interactive;
          if (!shown) {
            gsap.to(dot, { scale: interactive ? DOT_OVER_INTERACTIVE : 1, ...(interactive ? ENTER : LEAVE) });
          }
        }
        resolve();
      };

      const onLeaveWindow = () => {
        visible = false;
        gsap.to(root, { autoAlpha: 0, ...LEAVE });
        releaseAll();
      };

      window.addEventListener("mousemove", onMove, { passive: true });
      document.addEventListener("mouseover", onOver, { passive: true });
      document.documentElement.addEventListener("mouseleave", onLeaveWindow);
      document.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });

      return () => {
        unsubscribe();
        window.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseover", onOver);
        document.documentElement.removeEventListener("mouseleave", onLeaveWindow);
        document.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        releaseAll();
        document.body.classList.remove("has-custom-cursor");
      };
    }, rootRef);

    try {
      ctx = setup();
    } catch (err) {
      giveUp(err);
    }

    return () => {
      ctx?.revert();
      document.body.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden invisible"
    >
      <div
        ref={dotRef}
        className="fixed top-0 left-0 size-1.5 rounded-full bg-ink"
      />
      <div
        ref={ringRef}
        className="cursor-reticle fixed top-0 left-0 size-[76px] rounded-full border border-ink/60 bg-surface/70 backdrop-blur-sm grid place-items-center"
      >
        <span className="block overflow-clip">
          <span
            ref={labelRef}
            className="block font-mono text-label font-semibold text-ink leading-none py-0.5"
          />
        </span>
      </div>
    </div>
  );
}
