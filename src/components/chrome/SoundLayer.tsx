"use client";

import { useEffect } from "react";
import { useSoundStore } from "@/store/useSoundStore";
import { useThemeStore } from "@/store/useThemeStore";
import { crystalEvents } from "@/hooks/useCrystalPose";
import { initAudioContext } from "@/hooks/useCrystalSound";

const NAV_SELECTOR =
  'header a, header button, [role="group"][aria-label="Site mode"] button, footer a, footer button';

/** Softer and quieter than the toggle tick: a hover should whisper. */
function playHoverTick() {
  const ctx = initAudioContext();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.016, now);
  g.gain.exponentialRampToValueAtTime(0.0005, now + 0.04);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

interface Pad {
  gain: GainNode;
  nodes: AudioScheduledSourceNode[];
}

/** Low two-voice pad behind the dream: A2 + E3, slow filter drift. */
function createPad(ctx: AudioContext): Pad {
  const gain = ctx.createGain();
  gain.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  filter.Q.value = 0.7;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain).connect(filter.frequency);

  const voices: [number, OscillatorType, number][] = [
    [110, "triangle", 0.5],
    [110.7, "triangle", 0.35],
    [164.8, "sine", 0.3],
  ];
  const nodes: AudioScheduledSourceNode[] = [lfo];
  for (const [freq, type, level] of voices) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const vg = ctx.createGain();
    vg.gain.value = level;
    osc.connect(vg).connect(filter);
    osc.start();
    nodes.push(osc);
  }
  lfo.start();

  filter.connect(gain).connect(ctx.destination);
  return { gain, nodes };
}

export default function SoundLayer() {
  // Soft tick when the pointer enters a nav control
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let lastEl: Element | null = null;
    let lastT = 0;

    const onOver = (e: MouseEvent) => {
      if (!useSoundStore.getState().enabled) return;
      const target = (e.target as Element | null)?.closest(NAV_SELECTOR);
      if (!target || target === lastEl) {
        if (!target) lastEl = null;
        return;
      }
      lastEl = target;
      const now = performance.now();
      if (now - lastT < 80) return;
      lastT = now;
      playHoverTick();
    };

    document.addEventListener("mouseover", onOver, { passive: true });
    return () => document.removeEventListener("mouseover", onOver);
  }, []);

  // Low pad that fades in with the DREAM flood and out with WAKE
  useEffect(() => {
    let raf = 0;
    let pad: Pad | null = null;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const enabled = useSoundStore.getState().enabled;
      if (!enabled && !pad) return;

      const level = crystalEvents.floodActive
        ? crystalEvents.dreamLevel
        : useThemeStore.getState().mode === "dream"
          ? 1
          : 0;
      const target = enabled ? level * 0.045 : 0;

      // Only touch the AudioContext once the user has enabled sound
      // (the toggle click already resumed it: that is our user gesture).
      const ctx = initAudioContext();
      if (!pad && enabled && target > 0) pad = createPad(ctx);
      if (pad) pad.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.3);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (pad) {
        for (const n of pad.nodes) {
          try {
            n.stop();
          } catch {}
        }
        pad.gain.disconnect();
      }
    };
  }, []);

  return null;
}
