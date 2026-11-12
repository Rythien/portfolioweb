"use client";

import { useFrame } from "@react-three/fiber";
import { useScrollStore, getSectionProgress } from "@/store/useScrollStore";
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
}

const pose: CrystalPose = {
  x: 0.6, y: 0, z: 0,
  scale: 1.0,
  breakVal: 0,
  rotY: 0,
  rotX: 0,
  mouseX: 0,
  mouseY: 0,
};

const _d = { s: 0, x: 0.6, y: 0, scale: 1.0, breakVal: 0 };
let _lastE = -1;
let _prevBreak = 0;
let _shakeEnd = 0;
let _flashStart = -1;
let _reassembleStart = -1;
let _hoverBreakVal = 0;

export const crystalEvents = {
  burst: false,
  reassemble: false,
  shakeOffsetX: 0,
  shakeOffsetY: 0,
  flashOpacity: 0,
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

function tick(elapsed: number, delta: number) {
  if (Math.abs(elapsed - _lastE) < 0.0001) return;
  _lastE = elapsed;

  const rawS = getSectionProgress("works");
  const l = 1 - Math.exp(-4 * delta);
  _d.s += (rawS - _d.s) * l;
  const s = _d.s;

  const t25 = Math.min(s / 0.25, 1);
  const tx = 0.6 + t25 * 1.6;
  const ty = -t25 * 0.3;
  const ts = 1.0 - t25 * 0.5;

  // Scroll-driven break
  const scrollBreak = smoothstep(0.45, 0.65, s);

  // Hover-driven break (damped spring)
  const hoverTarget = useFractureStore.getState().hoverBreak ? 1 : 0;
  const hoverRate = hoverTarget > 0.5 ? 5.0 : 3.0;
  _hoverBreakVal += (hoverTarget - _hoverBreakVal) * (1 - Math.exp(-hoverRate * delta));
  if (Math.abs(_hoverBreakVal - hoverTarget) < 0.002) _hoverBreakVal = hoverTarget;

  // Whichever source is higher wins
  const tb = Math.max(scrollBreak, _hoverBreakVal);

  _d.x += (tx - _d.x) * l;
  _d.y += (ty - _d.y) * l;
  _d.scale += (ts - _d.scale) * l;
  _d.breakVal += (tb - _d.breakVal) * l;

  const rf = 1.0 - smoothstep(0, 0.25, s) * 0.7;
  pose.x = _d.x;
  pose.y = _d.y;
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

export function useCrystalPose(): CrystalPose {
  useFrame((st, dt) => tick(st.clock.elapsedTime, dt));
  return pose;
}

export function getCrystalPose(): CrystalPose {
  return pose;
}
