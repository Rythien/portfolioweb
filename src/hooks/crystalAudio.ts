/**
 * Web Audio primitives for the crystal and the chrome. Deliberately free
 * of three.js / R3F imports: the header and sound toggle use these on
 * every page, and importing them must not pull the 3D bundle along.
 */

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

export function playCrack() {
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

export function playReassemble() {
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

/* ── DESCENT cues (all callers check the Sound toggle first) ───── */

/** 0..1: how far the dream pad's filter opens (the game sets it by depth). */
let _padOpen = 0;
export function setPadOpen(v: number) {
  _padOpen = Math.max(0, Math.min(1, v));
}
export function getPadOpen(): number {
  return _padOpen;
}

function noiseBuffer(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * decay));
  return buf;
}

/** Thin ice taking a hit: a smaller, drier crack than the shatter. */
export function playIceCrack() {
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
export function playChime(pitch = 1) {
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
export function playThud() {
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
export function playRise() {
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
export function playWhoosh() {
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
