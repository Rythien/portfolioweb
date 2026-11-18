/**
 * Crystal pose and event state shared by the 3D scene and the page
 * chrome (preloader, mode pill, sound layer). Deliberately free of
 * three.js / R3F imports so chrome on every page can read and write it
 * without pulling the 3D bundle into the initial load. The R3F hook that
 * drives tickCrystalPose each frame lives in useCrystalPose.ts.
 */
import { getSectionProgress } from "@/store/useScrollStore";
import { useFractureStore } from "@/store/useFractureStore";
import { ease } from "@/lib/motion";
import { stepSpring, zetaForOvershoot, type Spring } from "@/motion/spring";

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** x mapped from [a, b] to [0, 1], clamped. */
function remap01(x: number, a: number, b: number): number {
  return Math.max(0, Math.min(1, (x - a) / (b - a)));
}

/* ── The hero -> parked move ──────────────────────────────────────
 *
 * One segment, u: 0 when About enters the viewport, 1 after
 * SEGMENT_VH viewport heights of scroll. It is eased ONCE with
 * SEGMENT_EASE, and every channel reads that eased progress p, each over
 * its own window so they arrive one after another instead of together:
 *
 *   position  p 0    -> 0.8   leads, and lands first
 *   scale     p 0.12 -> 1     starts a beat later and runs longer
 *   rotation  p 0.25 -> 1     the spin eases out last and the crystal
 *                             comes to rest at a deliberate angle
 *
 * The channels' targets are then followed by springs (not an
 * exponential damp): position critically damped (no overshoot), scale
 * with ~3% overshoot so it lands with a little weight.
 */
const SEGMENT_VH = 1.6;
/**
 * A strong ease-out on purpose. Measured on the same wheel scroll
 * (scripts/verify/crystal-arc.mjs, peak crystal travel per px of scroll):
 * this curve 2.5, in-out (0.65,0,0.35,1) 3.8, (0.4,0,0.2,1) 3.7, the old
 * smoothstep 3.6. About's copy reaches the hero crystal ~130px into the
 * scroll, and the copy clamp must have it clear by then: a curve that
 * starts gently leaves the clamp to yank it out of the way.
 */
// The scroll-linked curve from src/lib/motion.ts: cubic-bezier(0.16, 1, 0.3, 1)
const SEGMENT_EASE = ease.scroll;
const POS_WINDOW: [number, number] = [0, 0.8];
const SCALE_WINDOW: [number, number] = [0.12, 1];
const ROT_WINDOW: [number, number] = [0.25, 1];
/** Spring stiffness (rad/s): settles in ~0.6-0.8 s after the target stops. */
const POS_OMEGA = 7;
const SCALE_OMEGA = 6;
const SCALE_ZETA = zetaForOvershoot(0.03);
/** Free spin (rad/s) and the wobble on X, as before. */
const SPIN = 0.15;
/**
 * Resting angles: a quarter-turn apart, so the crystal never has more
 * than 90 deg to travel to the next one ahead. 0.3 rad is the hero's
 * 2 s pose (crystalfreeze=2), a three-quarter view with the logo clear.
 */
const REST_Y = 0.3;
const REST_STEP = Math.PI / 2;
const REST_X = 0.1;
/** Settling glides no faster than this (rad/s), then eases in. */
const SETTLE_MAX_SPEED = 0.6;
const SETTLE_GAIN = 1.2;
/** Reduced motion: where in the segment the hero -> parked swap happens
 * (0.04 = ~58px of scroll at 1440), at the bottom of a short fade. */
const REDUCED_SWAP_U = 0.04;

const _posX: Spring = { x: 0.6, v: 0 };
const _posY: Spring = { x: 0, v: 0 };
const _scale: Spring = { x: 1, v: 0 };
let _springsPrimed = false;
let _rotY = 0;
let _rotVel = SPIN;
/** The resting angle being settled toward, or null while spinning freely. */
let _restTarget: number | null = null;
/** Last segment progress, for the test hook. */
let _lastU = 0;

const _reducedMotion =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

export interface CrystalPose {
  x: number;
  y: number;
  z: number;
  scale: number;
  breakVal: number;
  rotY: number;
  rotX: number;
  mouseX: number;
  mouseY: number;
  /** Global crystal-system visibility: 1 over hero→Works, 0 past Works
   * (and during About/Disciplines on narrow viewports with no empty column). */
  fade: number;
  /** 0..1: how far the copy clamp has pulled the crystal off its free
   * pose. Ornaments that circle the crystal (the orbit ring) fade by it. */
  clamp: number;
}

const pose: CrystalPose = {
  x: 0.6, y: 0, z: 0,
  scale: 1.0,
  breakVal: 0,
  rotY: 0,
  rotX: 0,
  mouseX: 0,
  mouseY: 0,
  fade: 1,
  clamp: 0,
};

const _d = { s: 0, breakVal: 0, fade: 1 };

/** Matches SceneRoot's isMobile breakpoint. */
export const MOBILE_MAX_PX = 768;
/** Mobile hero crystal centre, world units above the viewport midline. */
const MOBILE_HERO_Y = 0.55;
/** Crystal scale when parked beside the About/Disciplines copy. */
const PARK_SCALE = 0.6;
/** Below this the parked crystal is too small to bother: it fades out. */
const PARK_SCALE_MIN = 0.4;
/** Visible silhouette radius at scale 1, as tuned for the marquee veil
 * (marqueeVeil.ts). The copy clamp does not use it: see _boundR. */
export const CRYSTAL_VISIBLE_R = 1.25;
/** Clearance from the copy column, and from the viewport edge. */
const PARK_GAP_PX = 24;
const PARK_EDGE_PX = 16;
/** Copy this far (px) above or below the crystal, beyond the gap, starts
 * easing it toward the clamp; within PARK_GAP_PX it is fully clamped. */
const CLAMP_RAMP_PX = 160;
const COPY_REMEASURE_S = 0.5;

/** Furthest vertex of the intact mesh from its centre (world units at
 * scale 1). GlassCrystal measures it from the geometry; 1.4 (the spike
 * radius) until then. */
let _boundR = 1.4;
export function setCrystalBoundRadius(r: number) {
  if (r > 0) _boundR = r;
}

/** Copy the crystal must not cover ([data-crystal-avoid]), as document
 * rects: [left, right, top, bottom] with top/bottom in page coordinates. */
let _copyRects: number[][] = [];
let _copyRightPx = -1;
let _copyMeasuredAt = -Infinity;
let _copyPxW = 0;

/** About's top in page coordinates (the segment starts as it enters), or -1. */
let _aboutDocTop = -1;

function measureCopy() {
  _copyRects = [];
  _copyRightPx = -1;
  if (typeof document === "undefined") return;
  const sy = window.scrollY;
  const about = document.getElementById("about");
  _aboutDocTop = about ? about.getBoundingClientRect().top + sy : -1;
  document.querySelectorAll("[data-crystal-avoid]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    _copyRects.push([r.left, r.right, r.top + sy, r.bottom + sy]);
    _copyRightPx = Math.max(_copyRightPx, r.right);
  });
}

/** Perspective camera the crystal is drawn with, in screen terms. */
interface View {
  /** Camera distance to the z = 0 plane. */
  d: number;
  /** CSS px per world unit on the z = 0 plane. */
  ppu: number;
  pxW: number;
  pxH: number;
}

/**
 * Screen extents (CSS px) of the crystal's bounding sphere at world (x, y)
 * and scale s: the tangent cone from the camera, so the perspective swell
 * of the near side and of an off-axis position are included.
 */
function extentsPx(x: number, y: number, s: number, v: View) {
  const rho = _boundR * s;
  const a = Math.asin(Math.min(rho / Math.hypot(x, y, v.d), 0.99));
  const tx = Math.atan2(x, v.d);
  const ty = Math.atan2(y, v.d);
  return {
    left: v.pxW / 2 + v.d * Math.tan(tx - a) * v.ppu,
    right: v.pxW / 2 + v.d * Math.tan(tx + a) * v.ppu,
    top: v.pxH / 2 - v.d * Math.tan(ty + a) * v.ppu,
    bottom: v.pxH / 2 - v.d * Math.tan(ty - a) * v.ppu,
  };
}

/** Largest scale whose silhouette fits between screen x left..right at y. */
function fitScalePx(left: number, right: number, y: number, v: View): number {
  if (right <= left) return 0;
  const tl = Math.atan(((left - v.pxW / 2) / v.ppu) / v.d);
  const tr = Math.atan(((right - v.pxW / 2) / v.ppu) / v.d);
  const xc = v.d * Math.tan((tl + tr) / 2);
  return (Math.hypot(xc, y, v.d) * Math.sin((tr - tl) / 2)) / _boundR;
}

/** World x that puts the silhouette's left edge at screen x `left`. */
function xForLeftPx(left: number, y: number, s: number, v: View): number {
  const tl = Math.atan(((left - v.pxW / 2) / v.ppu) / v.d);
  const rho = _boundR * s;
  let x = 0;
  for (let i = 0; i < 4; i++) {
    const a = Math.asin(Math.min(rho / Math.hypot(x, y, v.d), 0.99));
    x = v.d * Math.tan(tl + a);
  }
  return x;
}

/**
 * Keeps the crystal off the copy, from its CURRENT scale. Applied after
 * damping, so it holds mid-transition and through the reassembly pulse.
 *
 * For each copy rect: within PARK_GAP_PX above or below the crystal's
 * silhouette, the crystal is pushed right of the rect (left edge at
 * rect.right + gap) and shrunk to fit before the viewport edge; if less
 * than PARK_SCALE_MIN fits it shrinks away instead. Up to CLAMP_RAMP_PX
 * further out it eases toward that, so nothing pops as copy scrolls in.
 * The most restrictive rect wins (rightmost x, smallest scale). Vertical
 * distance is measured from the unclamped silhouette, which is never
 * smaller than the clamped one, so an eased crystal is always clear.
 */
function clampOffCopy(x: number, y: number, s: number, v: View) {
  if (_copyRects.length === 0 || s <= 0) return { x, s, w: 0 };
  const sy = typeof window === "undefined" ? 0 : window.scrollY;
  const ext = extentsPx(x, y, s, v);
  let outX = x;
  let outS = s;
  let w = 0;
  for (const [, right, docTop, docBottom] of _copyRects) {
    const top = docTop - sy;
    const bottom = docBottom - sy;
    const vd = Math.max(top - ext.bottom, ext.top - bottom, 0);
    const k = 1 - smoothstep(PARK_GAP_PX, PARK_GAP_PX + CLAMP_RAMP_PX, vd);
    if (k <= 0) continue;
    const left = right + PARK_GAP_PX;
    // Already clear of this rect horizontally: nothing to do
    if (ext.left >= left) continue;
    const fit = fitScalePx(left, v.pxW - PARK_EDGE_PX, y, v);
    const sc = fit < PARK_SCALE_MIN ? 0 : Math.min(s, fit);
    const xc = sc > 0 ? Math.max(x, xForLeftPx(left, y, sc, v)) : x;
    outX = Math.max(outX, x + (xc - x) * k);
    outS = Math.min(outS, s + (sc - s) * k);
    w = Math.max(w, k);
  }
  return { x: outX, s: outS, w };
}
let _lastE = -1;
let _prevBreak = 0;
let _shakeEnd = 0;
let _flashStart = -1;
let _reassembleStart = -1;
let _hoverBreakVal = 0;
let _introBreak = 0;
/** Test hook: pin the crystal's rotation to this time (s). */
let _timeOverride: number | null = null;
export function setCrystalTimeOverride(t: number | null) {
  _timeOverride = t;
}

/** Preloader drives this 1 → 0 so the shards gather into the intact crystal. */
export function setIntroBreak(v: number) {
  _introBreak = v;
}

export const crystalEvents = {
  burst: false,
  reassemble: false,
  shakeOffsetX: 0,
  shakeOffsetY: 0,
  flashOpacity: 0,
  /** True once the scene has produced its first rendered frame. */
  sceneReady: false,
  /** Flood progress 0 (wake) → 1 (dream), written by the Compositor. */
  dreamLevel: 0,
  /** True while the flood is animating; floodTarget is where it is heading. */
  floodActive: false,
  floodTarget: "wake" as "wake" | "dream",
  /** Flood circle in CSS px (centre and radius at level 1), written by the
   * Compositor when a flood starts; the Archive clips its reveal to it. */
  floodCenterX: 0,
  floodCenterY: 0,
  floodMaxRadiusPx: 0,
};

if (typeof window !== "undefined") {
  window.addEventListener(
    "mousemove",
    (e) => {
      pose.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      pose.mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true },
  );
}

export function tickCrystalPose(
  elapsed: number,
  delta: number,
  halfW: number,
  pxW: number,
  pxH: number,
  camZ: number,
) {
  if (Math.abs(elapsed - _lastE) < 0.0001) return;
  _lastE = elapsed;
  const view: View = { d: camZ, ppu: pxW / (2 * halfW), pxW, pxH };

  const rawS = getSectionProgress("works");
  const l = 1 - Math.exp(-4 * delta);
  _d.s += (rawS - _d.s) * l;
  const s = _d.s;
  const dt = Math.min(Math.max(delta, 0), 0.1);
  const reduced = !!_reducedMotion?.matches;

  // The segment u (see the top of the file), eased once into p. Until
  // About is measured, its section progress stands in so nothing moves early
  let u: number;
  if (_aboutDocTop >= 0 && typeof window !== "undefined") {
    const vh = window.innerHeight;
    const start = _aboutDocTop - vh;
    u = remap01(window.scrollY, start, start + SEGMENT_VH * vh);
  } else {
    u = remap01(getSectionProgress("about"), 0, 0.45);
  }
  _lastU = u;
  const p = SEGMENT_EASE(u);
  const narrow = halfW < 2.4;
  // Parked just right of the About body / Disciplines description columns
  // (measured), shrunk to fit the space left before the viewport edge
  if (elapsed - _copyMeasuredAt > COPY_REMEASURE_S || pxW !== _copyPxW) {
    measureCopy();
    _copyMeasuredAt = elapsed;
    _copyPxW = pxW;
  }
  let copyRightPx = _copyRightPx;
  if (copyRightPx < 0) {
    // Sections not mounted yet: text columns end at 10/12 of the grid
    const container = Math.min(pxW, 1280);
    const pad = pxW >= 1024 ? 64 : pxW >= 640 ? 40 : 24;
    copyRightPx = (pxW - container) / 2 + pad + (container - 2 * pad) * (10 / 12);
  }
  const PARK_Y = -0.5;
  const slotLeft = copyRightPx + PARK_GAP_PX;
  const slotRight = pxW - PARK_EDGE_PX;
  const parkScale = Math.min(PARK_SCALE, fitScalePx(slotLeft, slotRight, PARK_Y, view));
  // No usable column: sit out About/Disciplines like narrow viewports
  const noRoom = parkScale < PARK_SCALE_MIN;
  const xPark = Math.max(0.6, xForLeftPx(slotLeft, PARK_Y, Math.max(parkScale, PARK_SCALE_MIN), view));
  // Phones: centred just under the role label (MOBILE_HERO_Y), its lower
  // half crossing the marquee as on desktop; it sits out About onward
  const mobile = pxW < MOBILE_MAX_PX;
  const heroX = mobile ? 0 : 0.6;
  const heroY = mobile ? MOBILE_HERO_Y : 0;
  const heroScale = mobile ? 0.9 : 1.35;
  // Channel progress. Reduced motion: no travel at all, the hero pose,
  // then the parked pose, swapped at the bottom of a fade (pose.fade
  // below) near the START of the segment: it must be parked before
  // About's copy arrives (~130px in), or the copy clamp slides it aside
  const posP = reduced ? (u < REDUCED_SWAP_U ? 0 : 1) : remap01(p, POS_WINDOW[0], POS_WINDOW[1]);
  const scaleP = reduced ? posP : remap01(p, SCALE_WINDOW[0], SCALE_WINDOW[1]);
  const tx = heroX + (xPark - heroX) * posP;
  // Parked slightly below centre, in the pocket right of the body copy
  const ty = heroY + (PARK_Y - heroY) * posP;
  const ts = heroScale + (Math.max(parkScale, PARK_SCALE_MIN) - heroScale) * scaleP;

  // The crystal system leaves with Works; on narrow viewports there is
  // no empty column, so it also sits out About/Disciplines onward
  let fadeTarget = 1 - smoothstep(0.86, 0.985, rawS);
  if (narrow || noRoom) fadeTarget = Math.min(fadeTarget, 1 - posP);
  _d.fade += (fadeTarget - _d.fade) * (1 - Math.exp(-6 * delta));

  // Scroll-driven break: starts as Works enters, fully broken by 0.25
  const scrollBreak = smoothstep(0.05, 0.25, s);

  // Hover-driven break (damped spring)
  const hoverTarget = useFractureStore.getState().hoverBreak ? 1 : 0;
  const hoverRate = hoverTarget > 0.5 ? 5.0 : 3.0;
  _hoverBreakVal += (hoverTarget - _hoverBreakVal) * (1 - Math.exp(-hoverRate * delta));
  if (Math.abs(_hoverBreakVal - hoverTarget) < 0.002) _hoverBreakVal = hoverTarget;

  // Whichever source is higher wins
  const tb = Math.max(scrollBreak, _hoverBreakVal, _introBreak);

  // Springs follow the channel targets. First frame (under the
  // preloader) and reduced motion: placed, not travelled
  if (!_springsPrimed || reduced) {
    _posX.x = tx;
    _posY.x = ty;
    _scale.x = ts;
    _posX.v = _posY.v = _scale.v = 0;
    _springsPrimed = true;
  } else {
    stepSpring(_posX, tx, POS_OMEGA, 1, dt);
    stepSpring(_posY, ty, POS_OMEGA, 1, dt);
    stepSpring(_scale, ts, SCALE_OMEGA, SCALE_ZETA, dt);
  }
  _d.breakVal += (tb - _d.breakVal) * l;

  const rf = 1.0 - smoothstep(0, 0.25, s) * 0.7;
  // Clamped so the parked crystal never leaves the viewport vertically
  const y = Math.max(-0.9, Math.min(0.9, _posY.x));
  let scaleBoost = 0;
  if (_reassembleStart >= 0) {
    const rt = elapsed - _reassembleStart;
    if (rt < 0.4) {
      scaleBoost = 0.1 * Math.sin(Math.PI * rt / 0.4);
    } else {
      _reassembleStart = -1;
    }
  }
  const clamped = clampOffCopy(_posX.x, y, _scale.x + scaleBoost, view);
  pose.x = clamped.x;
  pose.y = y;
  pose.z = 0;
  pose.scale = clamped.s;
  pose.clamp = clamped.w;
  pose.breakVal = _d.breakVal;
  // Reduced motion: the hero -> parked swap happens inside a fade
  pose.fade = reduced ? _d.fade * smoothstep(0.004, 0.03, Math.abs(u - REDUCED_SWAP_U)) : _d.fade;

  // Rotation: speed is integrated, so changing it never jumps the angle.
  // Over ROT_WINDOW the spin eases out and the crystal glides to the next
  // resting angle ahead (never backwards, at most SETTLE_MAX_SPEED); as
  // Works breaks it, it spins freely again
  const settle = remap01(p, ROT_WINDOW[0], ROT_WINDOW[1]) * (1 - smoothstep(0.02, 0.15, s));
  if (_timeOverride !== null) {
    // Test hook (crystalfreeze): the pose is a pure function of that time
    pose.rotY = _timeOverride * SPIN * rf;
    pose.rotX = Math.sin(_timeOverride * 0.1) * 0.2 * rf;
  } else if (reduced) {
    _rotY = REST_Y;
    pose.rotY = REST_Y;
    pose.rotX = REST_X;
  } else {
    const free = SPIN * rf;
    let want = free;
    if (settle > 0.001) {
      // At least ~20 deg ahead, so it never arrives mid-ease and backs up
      if (_restTarget === null) {
        _restTarget = REST_Y + REST_STEP * Math.ceil((_rotY + 0.35 - REST_Y) / REST_STEP);
      }
      const glide = Math.max(-SETTLE_MAX_SPEED, Math.min(SETTLE_MAX_SPEED, (_restTarget - _rotY) * SETTLE_GAIN));
      want = free * (1 - settle) + glide * settle;
    } else {
      _restTarget = null;
    }
    _rotVel += (want - _rotVel) * (1 - Math.exp(-5 * dt));
    _rotY += _rotVel * dt;
    const wobble = Math.sin(elapsed * 0.1) * 0.2 * rf;
    pose.rotY = _rotY;
    pose.rotX = wobble + (REST_X - wobble) * settle;
  }

  useFractureStore.setState({ breakVal: _d.breakVal });

  if (_prevBreak < 0.08 && _d.breakVal >= 0.08) {
    crystalEvents.burst = true;
    _shakeEnd = elapsed + 0.08;
    _flashStart = elapsed;
  }
  if (_prevBreak > 0.05 && _d.breakVal <= 0.05) {
    crystalEvents.reassemble = true;
    _reassembleStart = elapsed;
  }
  _prevBreak = _d.breakVal;

  if (elapsed < _shakeEnd) {
    const k = 0.04 * (1 - (elapsed - _shakeEnd + 0.08) / 0.08);
    crystalEvents.shakeOffsetX = Math.sin(elapsed * 150) * k;
    crystalEvents.shakeOffsetY = Math.cos(elapsed * 200) * k;
  } else {
    crystalEvents.shakeOffsetX = 0;
    crystalEvents.shakeOffsetY = 0;
  }

  if (_flashStart >= 0 && elapsed - _flashStart < 0.15) {
    crystalEvents.flashOpacity = (1 - (elapsed - _flashStart) / 0.15) * 0.3;
  } else {
    crystalEvents.flashOpacity = 0;
  }
}

export function getCrystalPose(): CrystalPose {
  return pose;
}

// Test hook (scripts/verify/crystal-arc.mjs): the live pose and segment
if (typeof window !== "undefined") {
  (window as unknown as { __crystalPose: () => CrystalPose & { u: number } }).__crystalPose = () => ({
    ...pose,
    u: _lastU,
  });
}
