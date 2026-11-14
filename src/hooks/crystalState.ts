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
const MOBILE_HERO_Y = 0.8;
let _lastE = -1;
let _prevBreak = 0;
let _shakeEnd = 0;
let _flashStart = -1;
let _reassembleStart = -1;
let _hoverBreakVal = 0;
let _introBreak = 0;

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
  // for About/Disciplines (x ~ +2.2 at scale 0.45, clamped on narrow views)
  const park = smoothstep(0.08, 0.45, aboutP);
  const narrow = halfW < 2.4;
  // Parked just right of the About body / Disciplines description column
  // (text columns end at 10/12 of the max-w-7xl grid), clamped on-screen
  const container = Math.min(pxW, 1280);
  const pad = pxW >= 1024 ? 64 : pxW >= 640 ? 40 : 24;
  const colRightPx = (pxW - container) / 2 + pad + (container - 2 * pad) * (10 / 12);
  const pxPerUnit = pxW / (2 * halfW);
  const colRightWorld = (colRightPx - pxW / 2) / pxPerUnit;
  const xPark = Math.max(0.6, Math.min(colRightWorld + 0.7, halfW - 0.55));
  // Phones: centred at 0.7 in the band between the role label and the
  // headline (the marquee drops to match); it sits out About onward
  const mobile = pxW < MOBILE_MAX_PX;
  const heroX = mobile ? 0 : 0.6;
  const heroY = mobile ? MOBILE_HERO_Y : 0;
  const heroScale = mobile ? 0.7 : 1.0;
  const tx = heroX + (xPark - heroX) * park;
  // Parked slightly below centre, in the pocket right of the body copy
  const ty = heroY + (-0.5 - heroY) * park;
  const ts = heroScale + (0.45 - heroScale) * park;

  // The crystal system leaves with Works; on narrow viewports there is
  // no empty column, so it also sits out About/Disciplines onward
  let fadeTarget = 1 - smoothstep(0.86, 0.985, rawS);
  if (narrow) fadeTarget = Math.min(fadeTarget, 1 - park);
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
  pose.rotY = elapsed * 0.15 * rf;
  pose.rotX = Math.sin(elapsed * 0.1) * 0.2 * rf;

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
