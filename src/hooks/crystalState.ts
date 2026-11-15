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
/** Visible silhouette radius at scale 1 (the rock's R is 1.4 at its spikes). */
const CRYSTAL_VISIBLE_R = 1.25;
/** Clearance from the copy column, and from the viewport edge. */
const PARK_GAP_PX = 24;
const PARK_EDGE_PX = 16;
const COPY_REMEASURE_S = 0.5;
let _copyRightPx = -1;
let _copyMeasuredAt = -Infinity;
let _copyPxW = 0;

/** Right edge (px) of the copy the parked crystal must clear, or -1. */
function measureCopyRight(): number {
  if (typeof document === "undefined") return -1;
  let right = -1;
  document.querySelectorAll("[data-crystal-avoid]").forEach((el) => {
    right = Math.max(right, el.getBoundingClientRect().right);
  });
  return right;
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

export function tickCrystalPose(elapsed: number, delta: number, halfW: number, pxW: number) {
  if (Math.abs(elapsed - _lastE) < 0.0001) return;
  _lastE = elapsed;

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
    _copyRightPx = measureCopyRight();
    _copyMeasuredAt = elapsed;
    _copyPxW = pxW;
  }
  const pxPerUnit = pxW / (2 * halfW);
  let copyRightPx = _copyRightPx;
  if (copyRightPx < 0) {
    // Sections not mounted yet: text columns end at 10/12 of the grid
    const container = Math.min(pxW, 1280);
    const pad = pxW >= 1024 ? 64 : pxW >= 640 ? 40 : 24;
    copyRightPx = (pxW - container) / 2 + pad + (container - 2 * pad) * (10 / 12);
  }
  const slotLeft = copyRightPx + PARK_GAP_PX;
  const slotRight = pxW - PARK_EDGE_PX;
  const fitScale = (slotRight - slotLeft) / (2 * CRYSTAL_VISIBLE_R * pxPerUnit);
  const parkScale = Math.min(PARK_SCALE, fitScale);
  // No usable column: sit out About/Disciplines like narrow viewports
  const noRoom = parkScale < PARK_SCALE_MIN;
  const parkRadiusPx = CRYSTAL_VISIBLE_R * Math.max(parkScale, PARK_SCALE_MIN) * pxPerUnit;
  const xPark = Math.max(0.6, (slotLeft + parkRadiusPx - pxW / 2) / pxPerUnit);
  // Phones: centred just under the role label (MOBILE_HERO_Y), its lower
  // half crossing the marquee as on desktop; it sits out About onward
  const mobile = pxW < MOBILE_MAX_PX;
  const heroX = mobile ? 0 : 0.6;
  const heroY = mobile ? MOBILE_HERO_Y : 0;
  const heroScale = mobile ? 0.9 : 1.35;
  const tx = heroX + (xPark - heroX) * park;
  // Parked slightly below centre, in the pocket right of the body copy
  const ty = heroY + (-0.5 - heroY) * park;
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
  pose.x = _d.x;
  // Clamped so the parked crystal never leaves the viewport vertically
  pose.y = Math.max(-0.9, Math.min(0.9, _d.y));
  pose.z = 0;
  let scaleBoost = 0;
  if (_reassembleStart >= 0) {
    const rt = elapsed - _reassembleStart;
    if (rt < 0.4) {
      scaleBoost = 0.1 * Math.sin(Math.PI * rt / 0.4);
    } else {
      _reassembleStart = -1;
    }
  }
  pose.scale = _d.scale + scaleBoost;
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
