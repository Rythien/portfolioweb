/**
 * Game sound cues. Every cue goes through the site's existing Web Audio
 * graph (the shared AudioContext and the shatter/chime from
 * hooks/crystalAudio) and is silent unless the Sound toggle is on; with
 * sound off no AudioContext is even created. The game-only cues live here
 * so they load with the game chunk, not with every page.
 */
import { useSoundStore } from "@/store/useSoundStore";
import { initAudioContext, playCrack, playReassemble, setPadOpen } from "@/hooks/crystalAudio";
import { DIFFICULTY_CAP_METRES } from "./entities.ts";
import type { GameEvent } from "./engine.ts";

/* ── Game-only cues ───────────────────────────────────────── */

function noiseBuffer(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * decay));
  return buf;
}

/** Thin ice taking a hit: a smaller, drier crack than the shatter. */
function playIceCrack() {
  const ctx = initAudioContext();
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.07, 0.12);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.16, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.07);
}

/** Light mote: a soft two-partial bell. */
function playChime(pitch = 1) {
  const ctx = initAudioContext();
  const now = ctx.currentTime;
  for (const [f, lvl] of [[1320 * pitch, 0.05], [1980 * pitch, 0.025]] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(lvl, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.35);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}

/** Damage: a low thud under a detuned wobble. */
function playThud() {
  const ctx = initAudioContext();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(42, now + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.32, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.07, now);
  wg.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  lp.connect(wg).connect(ctx.destination);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 9;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 14;
  lfo.connect(lfoGain);
  for (const f of [196, 203.5]) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    lfoGain.connect(o.frequency);
    o.connect(lp);
    o.start(now);
    o.stop(now + 0.42);
  }
  lfo.start(now);
  lfo.stop(now + 0.42);
}

/** Band change: a tone rising a fifth. */
function playRise() {
  const ctx = initAudioContext();
  const now = ctx.currentTime;
  for (const [from, to, lvl] of [[330, 495, 0.05], [495, 742, 0.025]] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(lvl, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0005, now + 0.7);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }
}

/** Dash: a short filtered whoosh. */
function playWhoosh() {
  const ctx = initAudioContext();
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.18, 0.5);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(1800, now);
  bp.frequency.exponentialRampToValueAtTime(500, now + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + 0.18);
}

function soundOn(): boolean {
  return useSoundStore.getState().enabled;
}

/** Map engine events to cues. Called once per rendered frame. */
export function playEvents(events: GameEvent[]): void {
  if (events.length === 0 || !soundOn()) return;
  for (const e of events) {
    switch (e.type) {
      case "crack":
      case "break":
        playIceCrack();
        break;
      case "shatter":
        playCrack();
        break;
      case "damage":
        playThud();
        break;
      case "mote":
        playChime();
        break;
      case "life":
        playChime(1.5);
        break;
      case "band":
        if (e.band > 0) playRise();
        break;
      case "best":
        playReassemble();
        break;
      case "dash":
        playWhoosh();
        break;
    }
  }
}

/** The dream pad underneath opens up as the gem goes deeper. */
export function updatePad(depthM: number): void {
  setPadOpen(depthM / DIFFICULTY_CAP_METRES);
}

export function resetPad(): void {
  setPadOpen(0);
}
