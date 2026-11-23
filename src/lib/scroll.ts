/**
 * One scroll loop for the whole site. Lenis smooths the wheel, gsap.ticker
 * drives Lenis, ScrollTrigger reads Lenis through a scrollerProxy, and
 * scroll velocity is measured on that same ticker, so every scroll-linked
 * thing (triggers, skew, ticker, chips) sees the same frame.
 *
 * Client only. Importing this module registers the proxy, before any
 * component creates a ScrollTrigger (ScrollTrigger caches a scroller's
 * read function on first use, so a late proxy would be ignored).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type Lenis from "lenis";
import { DURATION } from "./motion";
import { useIntroStore } from "@/store/useIntroStore";

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

/** LenisProvider hands its instance over (null on teardown). */
export function setLenis(instance: Lenis | null) {
  lenis = instance;
}

export function getLenis() {
  return lenis;
}

const viewportRect = () => ({
  top: 0,
  left: 0,
  width: window.innerWidth,
  height: window.innerHeight,
});

if (typeof window !== "undefined") {
  // The page scroller is the document. Without Lenis (reduced motion,
  // before it mounts) the proxy falls through to native scroll.
  ScrollTrigger.scrollerProxy(document.documentElement, {
    scrollTop(value?: number) {
      if (arguments.length && value !== undefined) {
        if (lenis) lenis.scrollTo(value, { immediate: true });
        else window.scrollTo(0, value);
      }
      return lenis ? lenis.scroll : window.scrollY;
    },
    getBoundingClientRect: viewportRect,
    // Lenis moves the real document scroll, so pins stay position: fixed
    pinType: "fixed",
  });
}

/* ── Re-measuring ───────────────────────────────────────────────── */

/**
 * Trigger positions go stale whenever the layout moves under them: the
 * webfonts swapping in, the preloader handing the page over, a resize.
 * Each re-measures every ScrollTrigger (and reveals whose start is now
 * behind the reader finish, see settle() in motion.ts). Runs with or
 * without Lenis. Returns the teardown.
 */
export function installRefreshes() {
  let alive = true;
  const refresh = () => {
    if (alive) ScrollTrigger.refresh();
  };
  document.fonts?.ready.then(refresh);
  const unsubscribe = useIntroStore.subscribe((s, prev) => {
    if (s.done && !prev.done) requestAnimationFrame(refresh);
  });
  let timer = 0;
  const onResize = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, DURATION.quick * 1000);
  };
  window.addEventListener("resize", onResize, { passive: true });
  // The page changing height without a resize: a late style or font that
  // fonts.ready did not wait for, or copy swapping between WAKE and DREAM.
  // A refresh rebuilds the pin spacers at the same size, so this settles.
  let lastHeight = -1;
  const ro =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(([entry]) => {
          const h = Math.round(entry.contentRect.height);
          if (h === lastHeight) return;
          const first = lastHeight < 0;
          lastHeight = h;
          if (!first) onResize();
        });
  ro?.observe(document.body);
  return () => {
    alive = false;
    unsubscribe();
    window.clearTimeout(timer);
    window.removeEventListener("resize", onResize);
    ro?.disconnect();
  };
}

/* ── Velocity ───────────────────────────────────────────────────── */

let velocity = 0;
let lastY: number | null = null;
let users = 0;

function measure(_time: number, deltaMs: number) {
  const y = lenis ? lenis.scroll : window.scrollY;
  if (lastY !== null && deltaMs > 0) velocity = ((y - lastY) / deltaMs) * 1000;
  lastY = y;
}

/**
 * Start measuring (ref-counted). Call after Lenis is on the ticker so the
 * reading is taken after Lenis has moved this frame.
 */
export function startVelocity() {
  if (users++ === 0) {
    lastY = null;
    gsap.ticker.add(measure);
  }
  return () => {
    if (--users === 0) {
      gsap.ticker.remove(measure);
      velocity = 0;
    }
  };
}

/** Current scroll velocity, px/s (positive scrolling down). */
export function getVelocity() {
  return velocity;
}
