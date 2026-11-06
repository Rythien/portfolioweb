"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { crystalEvents } from "@/hooks/useCrystalPose";
import { useSoundStore } from "@/store/useSoundStore";

let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

export function initAudioContext() {
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function playTick() {
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.04, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);
}

function playCrack() {
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;

  const bufLen = ctx.sampleRate * 0.12;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.exp(-i / (bufLen * 0.15));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  src.connect(hp).connect(gain).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.12);

  // Tinkle: short sine bursts at high frequencies
  for (let t = 0; t < 3; t++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 3000 + Math.random() * 4000;
    const g = ctx.createGain();
    const onset = now + t * 0.03;
    g.gain.setValueAtTime(0.08, onset);
    g.gain.exponentialRampToValueAtTime(0.001, onset + 0.06);
    osc.connect(g).connect(ctx.destination);
    osc.start(onset);
    osc.stop(onset + 0.06);
  }
}

function playReassemble() {
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;

  // Chime: ascending sine tones
  const freqs = [880, 1100, 1320, 1760];
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freqs[i];
    const g = ctx.createGain();
    const onset = now + i * 0.06;
    g.gain.setValueAtTime(0, onset);
    g.gain.linearRampToValueAtTime(0.12, onset + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, onset + 0.25);
    osc.connect(g).connect(ctx.destination);
    osc.start(onset);
    osc.stop(onset + 0.25);
  }

  // Soft noise tail
  const bufLen = ctx.sampleRate * 0.15;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufLen * 0.3));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.15);
}

export function useCrystalSound() {
  const enabledRef = useRef(false);

  useEffect(() => {
    return useSoundStore.subscribe((s) => {
      enabledRef.current = s.enabled;
    });
  }, []);

  useFrame(() => {
    if (!enabledRef.current) {
      crystalEvents.burst = false;
      crystalEvents.reassemble = false;
      return;
    }
    if (crystalEvents.burst) {
      crystalEvents.burst = false;
      playCrack();
    }
    if (crystalEvents.reassemble) {
      crystalEvents.reassemble = false;
      playReassemble();
    }
  });
}
