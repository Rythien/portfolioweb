/**
 * Crystal pose and event state shared by the 3D scene and the page
 * chrome (preloader, mode pill, sound layer). Deliberately free of
 * three.js / R3F imports so chrome on every page can read and write it
 * without pulling the 3D bundle into the initial load. The R3F hook that
 * drives tickCrystalPose each frame lives in useCrystalPose.ts.
 */
import { getSectionProgress } from "@/store/useScrollStore";
import { useFractureStore } from "@/store/useFractureStore";

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

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

const _d = { s: 0, x: 0.6, y: 0, scale: 1.0, breakVal: 0, fade: 1 };

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

function measureCopy() {
  _copyRects = [];
  _copyRightPx = -1;
  if (typeof document === "undefined") return;
  const sy = window.scrollY;
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
  const aboutP = getSectionProgress("about");
  const l = 1 - Math.exp(-4 * delta);
  _d.s += (rawS - _d.s) * l;
  const s = _d.s;

  // 0 = hero composition, 1 = parked in the right-hand empty column
  // for About/Disciplines
  const park = smoothstep(0.08, 0.45, aboutP);
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
  const tx = heroX + (xPark - heroX) * park;
  // Parked slightly below centre, in the pocket right of the body copy
  const ty = heroY + (PARK_Y - heroY) * park;
  const ts = heroScale + (Math.max(parkScale, PARK_SCALE_MIN) - heroScale) * park;

  // The crystal system leaves with Works; on narrow viewports there is
  // no empty column, so it also sits out About/Disciplines onward
  let fadeTarget = 1 - smoothstep(0.86, 0.985, rawS);
  if (narrow || noRoom) fadeTarget = Math.min(fadeTarget, 1 - park);
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

  _d.x += (tx - _d.x) * l;
  _d.y += (ty - _d.y) * l;
  _d.scale += (ts - _d.scale) * l;
  _d.breakVal += (tb - _d.breakVal) * l;

  const rf = 1.0 - smoothstep(0, 0.25, s) * 0.7;
  // Clamped so the parked crystal never leaves the viewport vertically
  const y = Math.max(-0.9, Math.min(0.9, _d.y));
  let scaleBoost = 0;
  if (_reassembleStart >= 0) {
    const rt = elapsed - _reassembleStart;
    if (rt < 0.4) {
      scaleBoost = 0.1 * Math.sin(Math.PI * rt / 0.4);
    } else {
      _reassembleStart = -1;
    }
  }
  const clamped = clampOffCopy(_d.x, y, _d.scale + scaleBoost, view);
  pose.x = clamped.x;
  pose.y = y;
  pose.z = 0;
  pose.scale = clamped.s;
  pose.clamp = clamped.w;
  pose.breakVal = _d.breakVal;
  pose.fade = _d.fade;
  const rotT = _timeOverride ?? elapsed;
  pose.rotY = rotT * 0.15 * rf;
  pose.rotX = Math.sin(rotT * 0.1) * 0.2 * rf;

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
