/**
 * Archive sounds. Every one is behind the Sound toggle (useSoundStore)
 * and silent otherwise; none touch the AudioContext while sound is off.
 * Pitches sit on the dream pad's A (A2 + E3), so chimes and pad agree.
 */
import { initAudioContext, setPadHarmonics } from "@/hooks/crystalAudio";
import { useSoundStore } from "@/store/useSoundStore";

const on = () => useSoundStore.getState().enabled;

function ctxOrNull(): AudioContext | null {
  if (!on()) return null;
  try {
    return initAudioContext();
  } catch {
    return null;
  }
}

/** A sine partial with a fast attack and an exponential tail. */
function partial(ctx: AudioContext, dest: AudioNode, freq: number, at: number, peak: number, decay: number, attack = 0.006) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

function noiseBurst(ctx: AudioContext, seconds: number, shape: number): AudioBufferSourceNode {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * shape));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

/** A small feedback delay, the void's echo, shared by the long sounds. */
let _space: { ctx: AudioContext; input: GainNode } | null = null;
function space(ctx: AudioContext): GainNode {
  if (_space && _space.ctx === ctx) return _space.input;
  const input = ctx.createGain();
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.31;
  const fb = ctx.createGain();
  fb.gain.value = 0.42;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  input.connect(ctx.destination);
  input.connect(delay);
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(wet).connect(ctx.destination);
  _space = { ctx, input };
  return input;
}

/** Mote collected: a small bright chime, a step higher per mote of charge. */
export function playMote(charge: number) {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const f = [1318.5, 1661.2, 1975.5][Math.max(0, Math.min(2, charge - 1))];
  const out = space(ctx);
  partial(ctx, out, f, now, 0.05, 0.7);
  partial(ctx, out, f * 2.01, now, 0.015, 0.35);
}

/* ── Charged hum: held while the pulse is ready ───────────────── */

let _hum: { ctx: AudioContext; gain: GainNode } | null = null;
export function setChargedHum(charged: boolean) {
  if (!on()) {
    if (_hum) _hum.gain.gain.setTargetAtTime(0, _hum.ctx.currentTime, 0.08);
    return;
  }
  const ctx = ctxOrNull();
  if (!ctx) return;
  if (!_hum || _hum.ctx !== ctx) {
    if (!charged) return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    for (const [f, lvl] of [[220, 0.6], [220.9, 0.45], [440, 0.18], [659.3, 0.08]] as const) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(lp);
      o.start();
    }
    lp.connect(gain).connect(ctx.destination);
    _hum = { ctx, gain };
  }
  _hum.gain.gain.setTargetAtTime(charged ? 0.022 : 0, ctx.currentTime, charged ? 0.25 : 0.12);
}

/** Facet hit: the ice cracks (bright splinter over a hard knock). */
export function playFacetCrack() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = space(ctx);
  const n = noiseBurst(ctx, 0.18, 0.12);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.value = 0.28;
  n.connect(hp).connect(g).connect(out);
  n.start(now);
  for (let k = 0; k < 4; k++) partial(ctx, out, 2600 + Math.random() * 3800, now + k * 0.025, 0.05, 0.12);
  partial(ctx, out, 180, now, 0.12, 0.25, 0.003);
}

/** Wasted pulse (body, shard or nothing): a dull thud, no ring. */
export function playThud() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const n = noiseBurst(ctx, 0.2, 0.18);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const g = ctx.createGain();
  g.gain.value = 0.35;
  n.connect(lp).connect(g).connect(ctx.destination);
  n.start(now);
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(110, now);
  o.frequency.exponentialRampToValueAtTime(48, now + 0.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.exponentialRampToValueAtTime(0.14, now + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  o.connect(og).connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.3);
}

/** A project freed: a long resonant bell, one note of the A major triad per seal. */
const BLOOM_ROOTS = [440, 554.37, 659.25];
export function playFreeBloom(seal: number) {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = space(ctx);
  const f = BLOOM_ROOTS[seal % BLOOM_ROOTS.length];
  // Bell partials (slightly inharmonic), long tails
  partial(ctx, out, f, now, 0.09, 6.5, 0.01);
  partial(ctx, out, f * 2.0, now, 0.045, 4.8, 0.01);
  partial(ctx, out, f * 2.76, now, 0.03, 3.2, 0.008);
  partial(ctx, out, f * 5.4, now, 0.012, 1.6, 0.005);
  partial(ctx, out, f / 2, now + 0.05, 0.05, 7.5, 0.4);
  // The burst itself: a soft rush of shards
  const n = noiseBurst(ctx, 0.9, 0.35);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.value = 0.12;
  n.connect(bp).connect(g).connect(out);
  n.start(now);
}

/** Every shard home: the whole triad at once, longest of all. */
export function playReassembled() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const out = space(ctx);
  BLOOM_ROOTS.forEach((f, i) => {
    partial(ctx, out, f, now + i * 0.12, 0.07, 8, 0.02);
    partial(ctx, out, f * 2, now + i * 0.12, 0.03, 5, 0.02);
  });
  partial(ctx, out, 220, now, 0.06, 9, 0.8);
}

/** The pad gains one harmonic per project freed (0..3). */
export function setFreedHarmonics(n: number) {
  setPadHarmonics(n);
}

/** Leaving the Archive: the hum stops (the pad follows the flood itself). */
export function stopArchiveAudio() {
  if (_hum) _hum.gain.gain.setTargetAtTime(0, _hum.ctx.currentTime, 0.1);
  setPadHarmonics(0);
}
