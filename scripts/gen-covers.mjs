#!/usr/bin/env node
/**
 * Generative project artwork (GLACIER / AFTERGLOW, docs/direction.md).
 *
 * These are concept-art compositions, not screenshots or product renders.
 * Each project gets four seeded images, rendered with three.js in headless
 * Chromium (real transmissive ice-glass chips over a painted backdrop):
 *
 *   cover      hero composition: chips refracting the title watermark,
 *              faint grid, fog, tool logos as embossed glyphs
 *   detail-1   close-up: one large chip refracting the title, shallow DOF
 *   detail-2   the tool logos embossed under a row of glass chips
 *   detail-3   motion still: the title smeared along a light trail in fog
 *
 * Every image has a WAKE (cold paper) and a DREAM (violet afterglow)
 * variant, each at 1600x1000 and 800x500. Each project carries its own
 * accent (glass tint, glints, fog wash, registration mark, light trail)
 * so the three sets don't read as identical. Seed = FNV-1a(slug): runs
 * are byte-identical.
 *
 * Writes into <out>/<slug>/:
 *   <kind>.webp  <kind>-800.webp  <kind>-dream.webp  <kind>-dream-800.webp
 *
 * Usage:
 *   npm run gen:covers                          (writes to public/projects)
 *   npm run gen:covers -- --out <dir>           (review somewhere else)
 *   npm run gen:covers -- --only pixel-plus
 *   npm run gen:covers -- --sheet [path]        (contact sheet PNG; default
 *                                                <out>/contact-sheet.png)
 *
 * Fonts (Geist, Newsreader) are fetched from Google Fonts at render time.
 */
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as simpleIcons from "simple-icons";
import { projects } from "../src/content/projects.ts";

const ROOT = process.cwd();
const W = 1600;
const H = 1000;
const KINDS = ["cover", "detail-1", "detail-2", "detail-3"];

/* ── CLI ────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  const v = i >= 0 ? args[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
};
const outDir = path.resolve(ROOT, argVal("--out") ?? "public/projects");
const only = argVal("--only");
const wantSheet = args.includes("--sheet");
const sheetPath = path.resolve(ROOT, argVal("--sheet") ?? path.join(outDir, "contact-sheet.png"));

/* ── Project inputs ─────────────────────────────────────────────── */

// Per-project accent so the three sets read apart
const ACCENTS = {
  "pixel-plus": "#e39a2d", // warm amber
  "4c-iced-coffee": "#1fa9a3", // cold teal
  "kinetic-archive": "#e5322b", // signal red
};
const DEFAULT_ACCENT = "#8fa3ad";

// Same stack-name → logo mapping as the orbiting WorkChip
const ICON_KEYS = {
  React: "siReact",
  "Next.js": "siNextdotjs",
  "Tailwind CSS": "siTailwindcss",
  TypeScript: "siTypescript",
  "Node.js": "siNodedotjs",
  MongoDB: "siMongodb",
  Figma: "siFigma",
  Git: "siGit",
  Blender: "siBlender",
  "Framer Motion": "siFramer",
};

function iconsFor(project) {
  const names = [
    ...project.stack.frontend,
    ...(project.stack.backend ?? []),
    ...(project.stack.tools ?? []),
  ];
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const icon = simpleIcons[ICON_KEYS[name]];
    if (icon && !seen.has(icon.title)) {
      seen.add(icon.title);
      out.push({ path: icon.path, title: icon.title });
    }
  }
  return out.slice(0, 6);
}

/** FNV-1a, 32-bit. */
function hashSlug(slug) {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function titleLines(project) {
  const { title, titleAccent } = project;
  if (!titleAccent || !title.includes(titleAccent)) {
    return { caps: title.toUpperCase(), accent: "" };
  }
  return {
    caps: title.replace(titleAccent, "").replace(/\s+/g, " ").trim().toUpperCase(),
    accent: titleAccent.toLowerCase(),
  };
}

const fileName = (kind, mode, small) =>
  `${kind}${mode === "dream" ? "-dream" : ""}${small ? "-800" : ""}.webp`;

/* ── In-page renderer ───────────────────────────────────────────── */

const PAGE = /* html */ `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@800&family=Newsreader:ital,opsz,wght@1,6..72,400&display=block">
<script type="importmap">{"imports":{
  "three":"http://covers.local/three/build/three.module.js",
  "three/addons/":"http://covers.local/three/addons/"
}}</script>
<style>html,body{margin:0;background:#000}</style>
</head><body>
<canvas id="gl"></canvas>
<script type="module">
import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

const W = ${W}, H = ${H}, SS = 2;
const MARGIN = 96;
// CPU-backed 2D canvases: accelerated raster (stacked blur passes in
// particular) is not bit-exact between runs, and outputs must reproduce
const CPU_2D = { willReadFrequently: true };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mixHex = (a, b, t) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const rgbOf = (hex) => {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)].join(",");
};

const PALETTE = {
  wake: {
    bg: "#E9E7E2",
    grid: "rgba(26,26,30,0.075)",
    title: "rgba(26,26,30,0.085)",
    fog: "255,255,255",
    fogA: [0.10, 0.20],
    accentFogA: 0.17,
    embossFace: "#E3E1DB",
    embossHi: "rgba(255,255,255,0.95)",
    embossLo: "rgba(26,26,30,0.24)",
    chip: "#f6fafc",
    atten: "#d6e8ee",
    attenDist: 5,
    accentTint: 0.6,
    edge: "#1a1a1e",
    edgeA: 0.32,
    glow: "#000000",
    glowK: 0,
    env: 1.0,
    key: 1.6,
    shadow: 0.09,
  },
  dream: {
    bg: "#07062B",
    grid: "rgba(242,239,233,0.045)",
    title: "rgba(196,181,253,0.14)",
    fog: "168,148,255",
    fogA: [0.05, 0.12],
    accentFogA: 0.3,
    embossFace: "#0c0b36",
    embossHi: "rgba(196,181,253,0.38)",
    embossLo: "rgba(0,0,0,0.6)",
    chip: "#ebe6ff",
    atten: "#c9bcf5",
    attenDist: 6,
    accentTint: 0.3,
    edge: "#efe9ff",
    edgeA: 0.5,
    // "DREAM is the light inside it": chips carry a soft inner glow
    glow: "#a596ff",
    glowK: 0.42,
    env: 0.8,
    key: 0.9,
    shadow: 0.22,
  },
};

/* 2D helpers */

function radial(g, x, y, r, rgb, a) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, "rgba(" + rgb + "," + a + ")");
  grd.addColorStop(1, "rgba(" + rgb + ",0)");
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function newCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/** Caps line + italic accent on one baseline; returns the drawn width. */
function titleRun(g, lines, x, y, size, color) {
  g.fillStyle = color;
  g.font = "800 " + size + "px Geist";
  g.letterSpacing = -0.04 * size + "px";
  g.fillText(lines.caps, x, y);
  let w = g.measureText(lines.caps).width;
  if (lines.accent) {
    const a = size * 1.06;
    g.font = "italic 400 " + a + "px Newsreader";
    g.letterSpacing = -0.01 * a + "px";
    g.fillText(lines.accent, x + w + size * 0.22, y);
    w += size * 0.22 + g.measureText(lines.accent).width;
  }
  return w;
}

/** Two-line watermark: caps line, then the accent word indented below. */
function titleStack(g, lines, p, rng, opts = {}) {
  const span = opts.span ?? 0.9;
  const maxSize = opts.maxSize ?? 400;
  g.save();
  g.fillStyle = p.title;
  g.textBaseline = "alphabetic";
  g.font = "800 100px Geist";
  g.letterSpacing = "-4px";
  const w100 = g.measureText(lines.caps).width || 1;
  const size = Math.min(((W * span) / w100) * 100, maxSize);
  const top = opts.top ?? H * (0.24 + rng() * 0.08);
  const x0 = opts.x ?? MARGIN - size * 0.05;
  g.font = "800 " + size + "px Geist";
  g.letterSpacing = -0.04 * size + "px";
  g.fillText(lines.caps, x0, top + size * 0.72);
  if (lines.accent) {
    const indent = x0 + size * (0.4 + rng() * 0.9);
    // The accent stays whole: shrink it to fit between indent and margin
    g.font = "italic 400 100px Newsreader";
    g.letterSpacing = "-1px";
    const a100 = g.measureText(lines.accent).width || 1;
    const aSize = Math.min(size * 1.08, ((W - MARGIN * 0.5 - indent) / a100) * 100);
    g.font = "italic 400 " + aSize + "px Newsreader";
    g.letterSpacing = -0.01 * aSize + "px";
    g.fillText(lines.accent, indent, top + size * 0.72 + Math.max(aSize, size * 0.8) * 0.88);
  }
  g.restore();
  return size;
}

function embossIcon(g, icon, x, y, size, p) {
  const path = new Path2D(icon.path);
  const k = size / 24;
  const off = Math.max(1.1, size / 26);
  const draw = (dx, dy, fill) => {
    g.save();
    g.translate(x + dx, y + dy);
    g.scale(k, k);
    g.fillStyle = fill;
    g.fill(path);
    g.restore();
  };
  draw(off * 1.25, off * 1.25, p.embossLo);
  draw(-off, -off, p.embossHi);
  draw(0, 0, p.embossFace);
}

function glyphRow(g, icons, p) {
  const size = 34, gap = 26;
  let x = MARGIN;
  for (const icon of icons) {
    embossIcon(g, icon, x, H - MARGIN - size, size, p);
    x += size + gap;
  }
}

/** Printer's registration mark in the accent: one precise color note. */
function registration(g, accent, mode) {
  const x = MARGIN, y = MARGIN, r = 9;
  g.save();
  g.strokeStyle = mode === "wake" ? accent : mixHex(accent, "#ffffff", 0.35);
  g.globalAlpha = mode === "wake" ? 0.9 : 0.8;
  g.lineWidth = 1.25;
  g.beginPath();
  g.moveTo(x - r * 1.8, y + 0.5); g.lineTo(x + r * 1.8, y + 0.5);
  g.moveTo(x + 0.5, y - r * 1.8); g.lineTo(x + 0.5, y + r * 1.8);
  g.stroke();
  g.beginPath(); g.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); g.stroke();
  // Accent rule along the lower hairline: two grid columns of print color
  const colW = (W - 2 * MARGIN) / 12;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W - MARGIN - colW * 2, H - MARGIN + 0.5);
  g.lineTo(W - MARGIN, H - MARGIN + 0.5);
  g.stroke();
  g.restore();
}

function grid(g, p) {
  g.strokeStyle = p.grid;
  g.lineWidth = 1;
  const colW = (W - 2 * MARGIN) / 12;
  for (let i = 0; i <= 12; i++) {
    const x = Math.round(MARGIN + i * colW) + 0.5;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (const y of [MARGIN, H - MARGIN]) {
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke();
  }
}

function fog(g, p, rng, accent, count = 7, scale = 1) {
  for (let k = 0; k < count; k++) {
    const a = (p.fogA[0] + rng() * (p.fogA[1] - p.fogA[0])) * scale;
    radial(g, rng() * W, rng() * H, 260 + rng() * 460, p.fog, a.toFixed(3));
  }
  // Thicker air never means a louder accent wash
  radial(g, (0.2 + rng() * 0.6) * W, (0.3 + rng() * 0.5) * H, 520 + rng() * 260, rgbOf(accent), p.accentFogA * Math.min(scale, 1));
}

function grain(g, rng, alpha) {
  const t = newCanvas(256, 256);
  const tg = t.getContext("2d", CPU_2D);
  const img = tg.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rng() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = alpha * 255;
  }
  tg.putImageData(img, 0, 0);
  g.fillStyle = g.createPattern(t, "repeat");
  g.fillRect(0, 0, W, H);
}

function baseLight(g, mode, rng) {
  const fx = 0.55 + rng() * 0.25, fy = 0.3 + rng() * 0.3;
  if (mode === "wake") {
    radial(g, W * 0.15, H * 0.05, 950, "255,255,255", 0.6);
    radial(g, W * 0.92, H * 1.05, 820, "200,220,230", 0.38);
  } else {
    radial(g, fx * W, fy * H, 780, "124,92,255", 0.40);
    radial(g, (1 - fx) * W, H * 0.98, 720, "48,36,150", 0.50);
    radial(g, fx * W, fy * H, 280, "236,190,255", 0.20);
  }
  return { x: fx, y: fy };
}

/** Backdrop canvas at SS scale; draw(g) paints the kind-specific layers. */
function backdrop(mode, draw) {
  const p = PALETTE[mode];
  const c = newCanvas(W * SS, H * SS);
  const g = c.getContext("2d", CPU_2D);
  g.scale(SS, SS);
  g.fillStyle = p.bg;
  g.fillRect(0, 0, W, H);
  draw(g, p);
  return c;
}

/* three.js stage */
const glCanvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas, antialias: true, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(W * SS, H * SS, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const pmrem = new THREE.PMREMGenerator(renderer);

// Same idea as the site crystal's Lightformer rig: a black field with a
// few bright strips (one in the project accent), so glass reads through
// crisp dark/bright facet edges instead of washing out on pale paper
const envCache = new Map();
function stripEnvironment(accent) {
  if (envCache.has(accent)) return envCache.get(accent);
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  const strip = (w, h, pos, color, k) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  // Camera-side strips: faces turned toward the viewer reflect +z
  strip(9, 1.4, [3, 4, 6], "#ffffff", 3.4);
  strip(7, 0.9, [-5, 2, 5], "#ffffff", 2.6);
  strip(10, 1.0, [0, -4, 5], "#ffffff", 1.6);
  strip(2.5, 5, [6, -1, 3], accent, 3.2);
  strip(5, 0.8, [-3, -3, 6], accent, 2.0);
  strip(2.5, 5, [-6, -1, 2], "#f0b0c8", 1.1);
  strip(8, 1.2, [2, 5, -4], "#ffffff", 1.5);
  const tex = pmrem.fromScene(s, 0.02).texture;
  envCache.set(accent, tex);
  return tex;
}

const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
camera.position.set(0, 0, 10);
const CAM_Z = 10;
const viewH = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(15));
const viewW = viewH * (W / H);
/** Normalised screen point (0..1, y down) → world xy on the z plane. */
const toWorld = (nx, ny, z = 0) => {
  const k = (CAM_Z - z) / CAM_Z;
  return [(nx - 0.5) * viewW * k, (0.5 - ny) * viewH * k];
};

function chipGeometry(rng, size, shape = {}) {
  const sx = shape.sx ?? 1;
  const sy = shape.sy ?? 0.6 + rng() * 0.7;
  const sz = shape.sz ?? 0.35 + rng() * 0.35;
  const n = shape.n ?? 10 + Math.floor(rng() * 7);
  const box = shape.box ?? false;
  const pts = [];
  for (let k = 0; k < n; k++) {
    let v;
    if (box) {
      v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
      v.multiplyScalar(0.75 + rng() * 0.25 / Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z), 0.3));
      v.clampLength(0, 1.15);
    } else {
      const th = Math.acos(2 * rng() - 1), ph = 2 * Math.PI * rng();
      const r = 0.7 + rng() * 0.3;
      v = new THREE.Vector3(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th));
    }
    pts.push(new THREE.Vector3(v.x * sx * size, v.y * sy * size, v.z * sz * size));
  }
  return new ConvexGeometry(pts);
}

/* Composition layouts: each returns chips [{geo,pos,rot}] for a seed */

function coverChips(seed, focal) {
  const rng = mulberry32(seed ^ 0x85ebca6b);
  const count = 8 + Math.floor(rng() * 5);
  const [fx, fy] = toWorld(focal.x, focal.y);
  const chips = [];
  for (let i = 0; i < count; i++) {
    const size = i === 0 ? 1.15 + rng() * 0.35 : i < 3 ? 0.5 + rng() * 0.35 : 0.1 + rng() * 0.22;
    const geo = chipGeometry(rng, size);
    let x = fx, y = fy;
    if (i > 0) {
      const a = rng() * Math.PI * 2;
      const d = (0.7 + rng() * 2.4) * (i < 3 ? 0.75 : 1.15);
      x = fx + Math.cos(a) * d * 1.3;
      y = fy + Math.sin(a) * d * 0.8;
    }
    // Close to the paper so contact shadows stay tight
    const z = 0.35 + size * 0.45 + rng() * 0.3;
    chips.push({ geo, pos: [x, y, z], rot: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI] });
  }
  return chips;
}

function closeUpChips(seed) {
  const rng = mulberry32(seed ^ 0x27d4eb2f);
  const size = 2.15 + rng() * 0.3;
  const geo = chipGeometry(rng, size, { n: 22, sy: 0.82 + rng() * 0.25, sz: 0.5 + rng() * 0.1 });
  const z = 1.5;
  const [x, y] = toWorld(0.5 + (rng() - 0.5) * 0.18, 0.5 + (rng() - 0.5) * 0.12, z);
  return [{ geo, pos: [x, y, z], rot: [rng() * 0.9 - 0.45, rng() * Math.PI, rng() * Math.PI] }];
}

/** Row of chips sitting over the embossed logos (logo slots in px). */
function rowChips(seed, slots) {
  const rng = mulberry32(seed ^ 0x165667b1);
  return slots.map((s) => {
    // Thin, nearly face-on tiles so the logo underneath stays readable
    const z = 0.55;
    const [x, y] = toWorld(s.nx, s.ny, z);
    const size = 0.62 + rng() * 0.06;
    const geo = chipGeometry(rng, size, { box: true, n: 18, sx: 1, sy: 0.95, sz: 0.28 });
    return { geo, pos: [x, y, z], rot: [(rng() - 0.5) * 0.22, (rng() - 0.5) * 0.22, (rng() - 0.5) * 0.5] };
  });
}

function trailChips(seed, trail) {
  const rng = mulberry32(seed ^ 0xd3a2646c);
  const chips = [];
  for (let i = 0; i < 6; i++) {
    const t = 0.55 + rng() * 0.35;
    const pt = trail.at(t);
    const z = 0.6 + rng() * 0.9;
    const [x, y] = toWorld(pt.x / W + (rng() - 0.5) * 0.08, pt.y / H + (rng() - 0.5) * 0.12, z);
    const size = 0.1 + rng() * 0.22;
    chips.push({ geo: chipGeometry(rng, size), pos: [x, y, z], rot: [rng() * 3, rng() * 3, rng() * 3] });
  }
  return chips;
}

/* Light trail (cubic bezier across the frame) */
function makeTrail(rng) {
  const y0 = (0.55 + rng() * 0.25) * H, y3 = (0.28 + rng() * 0.2) * H;
  const P = [
    { x: -0.08 * W, y: y0 },
    { x: (0.25 + rng() * 0.15) * W, y: y0 - (rng() * 0.25 - 0.05) * H },
    { x: (0.6 + rng() * 0.15) * W, y: y3 + (rng() * 0.3 - 0.1) * H },
    { x: 1.08 * W, y: y3 },
  ];
  const at = (t) => {
    const u = 1 - t;
    return {
      x: u * u * u * P[0].x + 3 * u * u * t * P[1].x + 3 * u * t * t * P[2].x + t * t * t * P[3].x,
      y: u * u * u * P[0].y + 3 * u * u * t * P[1].y + 3 * u * t * t * P[2].y + t * t * t * P[3].y,
    };
  };
  return { P, at };
}

function strokeTrail(g, trail, color, width, alpha, blur) {
  g.save();
  g.filter = blur ? "blur(" + blur + "px)" : "none";
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = width;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(trail.P[0].x, trail.P[0].y);
  g.bezierCurveTo(trail.P[1].x, trail.P[1].y, trail.P[2].x, trail.P[2].y, trail.P[3].x, trail.P[3].y);
  g.stroke();
  g.restore();
}

/* Kind definitions: backdrop painter + chip layout (+ optional post) */

function composeKind(kind, mode, o) {
  const p = PALETTE[mode];
  const accent = o.accent;
  if (kind === "cover") {
    let focal;
    const canvas = backdrop(mode, (g) => {
      const rng = mulberry32(o.seed ^ 0x9e3779b9);
      focal = baseLight(g, mode, rng);
      grid(g, p);
      titleStack(g, o.lines, p, mulberry32(o.seed));
      fog(g, p, rng, accent);
      glyphRow(g, o.icons, p);
      registration(g, accent, mode);
      grain(g, rng, mode === "wake" ? 0.035 : 0.05);
    });
    return { canvas, chips: () => coverChips(o.seed, focal) };
  }

  if (kind === "detail-1") {
    const canvas = backdrop(mode, (g) => {
      const rng = mulberry32(o.seed ^ 0x51ed270b);
      baseLight(g, mode, rng);
      // The paper sits below the focal plane: grid and title go soft
      const layer = newCanvas(W, H);
      const lg = layer.getContext("2d", CPU_2D);
      grid(lg, p);
      lg.textBaseline = "alphabetic";
      const size = Math.min(470, W * 0.3);
      const y = H * (0.5 + (rng() - 0.5) * 0.08) + size * 0.34;
      titleRun(lg, o.lines, MARGIN * 0.6 - rng() * size * 0.6, y, size, p.title.replace(/[\\d.]+\\)$/, (m) => (parseFloat(m) * 1.35).toFixed(3) + ")"));
      g.save();
      g.filter = "blur(3.5px)";
      g.drawImage(layer, 0, 0);
      g.restore();
      fog(g, p, rng, accent, 5, 0.8);
      registration(g, accent, mode);
      grain(g, rng, mode === "wake" ? 0.035 : 0.05);
    });
    const post = (g) => {
      // Out-of-focus foreground shards (bokeh) at the frame edges
      const rng = mulberry32(o.seed ^ 0x6c8e9cf5);
      const tint = mode === "wake" ? "#ffffff" : mixHex(accent, "#c4b5fd", 0.55);
      for (let i = 0; i < 4; i++) {
        const cx = (rng() < 0.5 ? rng() * 0.18 : 0.82 + rng() * 0.18) * W;
        const cy = rng() * H;
        const r = 70 + rng() * 120;
        g.save();
        g.filter = "blur(" + (18 + rng() * 14) + "px)";
        g.globalAlpha = mode === "wake" ? 0.42 : 0.3;
        g.fillStyle = tint;
        g.beginPath();
        const sides = 5 + Math.floor(rng() * 3);
        for (let k = 0; k < sides; k++) {
          const a = (k / sides) * Math.PI * 2 + rng() * 0.5;
          const rr = r * (0.7 + rng() * 0.3);
          g[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        g.fill();
        g.restore();
      }
    };
    return { canvas, chips: () => closeUpChips(o.seed), post };
  }

  if (kind === "detail-2") {
    const n = Math.min(6, Math.max(3, o.icons.length));
    const first = Math.floor((n - o.icons.length) / 2);
    const slots = [];
    const span = 0.74;
    for (let i = 0; i < n; i++) {
      slots.push({
        nx: 0.5 - span / 2 + (n === 1 ? span / 2 : (i / (n - 1)) * span),
        ny: 0.56,
        icon: o.icons[i - first] ?? null,
      });
    }
    const canvas = backdrop(mode, (g) => {
      const rng = mulberry32(o.seed ^ 0x2545f491);
      baseLight(g, mode, rng);
      grid(g, p);
      titleStack(g, o.lines, p, mulberry32(o.seed ^ 0x7f4a7c15), { span: 0.62, maxSize: 260, top: H * 0.06 });
      fog(g, p, rng, accent, 6, 0.9);
      const size = 92;
      for (const s of slots) {
        if (s.icon) embossIcon(g, s.icon, s.nx * W - size / 2, s.ny * H - size / 2, size, p);
      }
      registration(g, accent, mode);
      grain(g, rng, mode === "wake" ? 0.035 : 0.05);
    });
    return { canvas, chips: () => rowChips(o.seed, slots) };
  }

  // detail-3: motion still
  let trail;
  const canvas = backdrop(mode, (g) => {
    const rng = mulberry32(o.seed ^ 0x3c6ef372);
    baseLight(g, mode, rng);
    const gl = newCanvas(W, H).getContext("2d", CPU_2D);
    grid(gl, p);
    g.save(); g.globalAlpha = 0.6; g.drawImage(gl.canvas, 0, 0); g.restore();
    trail = makeTrail(rng);

    // The title smeared along the trail: faint motion copies behind,
    // one legible copy riding the head
    let size = Math.min(200, W * 0.13);
    const ink = mode === "wake" ? "rgba(26,26,30,1)" : "rgba(214,204,255,1)";
    g.save();
    g.textBaseline = "middle";
    // Measure the full run (caps + italic accent) so the head copy fits
    const probe = newCanvas(10, 10).getContext("2d", CPU_2D);
    let runW = titleRun(probe, o.lines, 0, 0, size, ink);
    // Long titles shrink so the legible copy fits inside the margins
    const maxRun = (W - 2 * MARGIN) * 0.92;
    if (runW > maxRun) {
      size *= maxRun / runW;
      runW = titleRun(probe, o.lines, 0, 0, size, ink);
    }
    const head = 0.7;
    const hp = trail.at(head);
    // Shift every copy so the legible one ends inside the right margin
    const shift = Math.max(
      MARGIN - (hp.x - runW * 0.5),
      Math.min(0, W - MARGIN - (hp.x + runW * 0.5)),
    );
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const w = i / (steps - 1); // 0 = tail, 1 = just behind the head
      const t = head - 0.34 * (1 - w);
      const pt = trail.at(t);
      g.filter = "blur(" + (10 * (1 - w) + 2.5).toFixed(1) + "px)";
      g.globalAlpha = (mode === "wake" ? 0.012 : 0.02) + (mode === "wake" ? 0.03 : 0.045) * w;
      titleRun(g, o.lines, pt.x - runW * 0.5 + shift, pt.y, size, ink);
    }
    g.filter = "blur(0.6px)";
    g.globalAlpha = mode === "wake" ? 0.16 : 0.24;
    titleRun(g, o.lines, hp.x - runW * 0.5 + shift, hp.y, size, ink);
    g.restore();

    // Light trail: soft accent halo, bright core
    const comp = mode === "dream" ? "lighter" : "source-over";
    g.save();
    g.globalCompositeOperation = comp;
    const halo = mode === "wake" ? mixHex(accent, "#ffffff", 0.15) : mixHex(accent, "#a894ff", 0.4);
    strokeTrail(g, trail, halo, 150, mode === "wake" ? 0.10 : 0.16, 40);
    strokeTrail(g, trail, halo, 60, mode === "wake" ? 0.18 : 0.24, 16);
    strokeTrail(g, trail, mixHex(halo, "#ffffff", 0.5), 16, mode === "wake" ? 0.45 : 0.5, 4);
    strokeTrail(g, trail, "#ffffff", 3, mode === "wake" ? 0.85 : 0.95, 0.6);
    g.restore();

    fog(g, p, rng, accent, 9, 1.5);
    registration(g, accent, mode);
    grain(g, rng, mode === "wake" ? 0.04 : 0.055);
  });
  return { canvas, chips: () => trailChips(o.seed, trail) };
}

function renderKind(kind, mode, o, cache) {
  const p = PALETTE[mode];
  const { canvas, chips: makeChips, post } = composeKind(kind, mode, o);
  // Same chip geometry in both modes
  if (!cache[kind]) cache[kind] = makeChips();
  const chips = cache[kind];

  const scene = new THREE.Scene();
  scene.environment = stripEnvironment(o.accent);
  scene.environmentIntensity = p.env;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const planeGeo = new THREE.PlaneGeometry(viewW, viewH);
  const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scene.add(plane);

  // Hard-ish contact shadows on the paper ("cold paper, hard shadows")
  const shadowPlane = new THREE.Mesh(planeGeo, new THREE.ShadowMaterial({ opacity: p.shadow }));
  shadowPlane.position.z = 0.01;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  const key = new THREE.DirectionalLight(0xffffff, p.key);
  key.position.set(-3, 4, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -viewW / 2, right: viewW / 2, top: viewH / 2, bottom: -viewH / 2, near: 1, far: 30 });
  scene.add(key);
  if (mode === "dream") {
    const rim = new THREE.PointLight(new THREE.Color(mixHex("#a894ff", o.accent, 0.35)), 30, 12);
    rim.position.set(2, 1.5, 3);
    scene.add(rim);
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: p.chip,
    transmission: 1,
    thickness: 1.8,
    roughness: 0.03,
    ior: 1.5,
    dispersion: 4,
    attenuationColor: mixHex(p.atten, o.accent, p.accentTint),
    attenuationDistance: p.attenDist,
    specularIntensity: 0.8,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08,
    emissive: mode === "dream" ? mixHex(p.glow, o.accent, 0.38) : p.glow,
    emissiveIntensity: p.glowK,
    flatShading: true,
  });
  // Hairline facet edges: the specimen-drawing read that keeps clear
  // ice legible on pale paper
  const edgeMat = new THREE.LineBasicMaterial({ color: p.edge, transparent: true, opacity: p.edgeA, toneMapped: false });
  for (const c of chips) {
    const m = new THREE.Mesh(c.geo, mat);
    m.position.set(...c.pos);
    m.rotation.set(...c.rot);
    m.castShadow = true;
    scene.add(m);
    if (!c.edges) c.edges = new THREE.EdgesGeometry(c.geo, 8);
    const e = new THREE.LineSegments(c.edges, edgeMat);
    e.position.copy(m.position);
    e.rotation.copy(m.rotation);
    e.renderOrder = 2;
    scene.add(e);
  }

  renderer.render(scene, camera);

  const out = newCanvas(W, H);
  const og = out.getContext("2d", CPU_2D);
  og.imageSmoothingQuality = "high";
  og.drawImage(glCanvas, 0, 0, W, H);
  if (post) post(og);
  const small = newCanvas(800, 500);
  const sg = small.getContext("2d", CPU_2D);
  sg.imageSmoothingQuality = "high";
  sg.drawImage(out, 0, 0, 800, 500);

  tex.dispose();
  mat.dispose();
  edgeMat.dispose();
  planeGeo.dispose();
  return {
    full: out.toDataURL("image/webp", 0.86),
    small: small.toDataURL("image/webp", 0.82),
  };
}

window.renderSet = async (o, kinds) => {
  await document.fonts.load("800 100px Geist");
  await document.fonts.load("italic 400 100px Newsreader");
  const cache = {};
  const results = {};
  for (const kind of kinds) {
    results[kind] = {};
    for (const mode of ["wake", "dream"]) results[kind][mode] = renderKind(kind, mode, o, cache);
  }
  return results;
};
window.__ready = true;
</script></body></html>`;

/* ── Run ────────────────────────────────────────────────────────── */

const MIME = { ".js": "text/javascript", ".html": "text/html" };

const launchOpts = {
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-accelerated-2d-canvas",
  ],
};
let browser;
try {
  browser = await chromium.launch(launchOpts);
} catch {
  // Bundled build not downloaded: fall back to an installed Chromium
  browser = await chromium.launch({ ...launchOpts, channel: process.env.COVERS_CHANNEL ?? "msedge" });
}
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.on("pageerror", (e) => console.error("[page]", e.message));
await page.route("http://covers.local/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === "/index.html") {
    return route.fulfill({ body: PAGE, contentType: "text/html" });
  }
  let file = null;
  if (url.pathname.startsWith("/three/build/")) {
    file = path.join(ROOT, "node_modules/three/build", url.pathname.slice("/three/build/".length));
  } else if (url.pathname.startsWith("/three/addons/")) {
    file = path.join(ROOT, "node_modules/three/examples/jsm", url.pathname.slice("/three/addons/".length));
  }
  if (!file) return route.fulfill({ status: 404, body: "" });
  try {
    const body = await readFile(file);
    return route.fulfill({ body, contentType: MIME[path.extname(file)] ?? "application/octet-stream" });
  } catch {
    return route.fulfill({ status: 404, body: "" });
  }
});
await page.goto("http://covers.local/index.html");
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

const decode = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
const written = [];
const selected = projects.filter((p) => !only || p.slug === only);

for (const project of selected) {
  const seed = hashSlug(project.slug);
  const t0 = Date.now();
  const res = await page.evaluate(([o, kinds]) => window.renderSet(o, kinds), [
    {
      seed,
      accent: ACCENTS[project.slug] ?? DEFAULT_ACCENT,
      lines: titleLines(project),
      icons: iconsFor(project),
    },
    KINDS,
  ]);
  const dir = path.join(outDir, project.slug);
  await mkdir(dir, { recursive: true });
  for (const kind of KINDS) {
    for (const mode of ["wake", "dream"]) {
      for (const small of [false, true]) {
        const data = res[kind][mode][small ? "small" : "full"];
        const buf = decode(data);
        const name = fileName(kind, mode, small);
        await writeFile(path.join(dir, name), buf);
        written.push({ slug: project.slug, kind, mode, small, name, kb: Math.round(buf.length / 1024), data });
      }
    }
  }
  console.log(`${project.slug}  seed=${seed}  ${Date.now() - t0}ms`);
}

if (wantSheet) {
  const cell = (w) => `<figure><img src="${w.data}"><figcaption>${w.name} · ${w.kb}KB</figcaption></figure>`;
  const rows = selected
    .map((p) => {
      const pick = (mode) => KINDS.map((k) => written.find((w) => w.slug === p.slug && w.kind === k && w.mode === mode && !w.small));
      return `<section><h2>${p.title}<span>${p.slug} · accent ${ACCENTS[p.slug] ?? DEFAULT_ACCENT}</span></h2>
        <div class="grid">${pick("wake").map(cell).join("")}</div>
        <div class="grid">${pick("dream").map(cell).join("")}</div></section>`;
    })
    .join("");
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.setContent(`<!doctype html><html><head><style>
    body{margin:0;padding:28px;background:#111;color:#ddd;font:13px ui-monospace,monospace}
    h1{font-size:18px;color:#fff;margin:0 0 20px}
    section{margin-bottom:32px}
    h2{font-size:16px;color:#fff;margin:0 0 10px;font-weight:600}
    h2 span{margin-left:12px;color:#999;font-size:13px;font-weight:400}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
    figure{margin:0}
    img{width:100%;display:block;border-radius:2px}
    figcaption{color:#888;margin-top:4px}
  </style></head><body><h1>Concept artwork preview · top row WAKE, bottom row DREAM · cover, detail-1, detail-2, detail-3</h1>${rows}</body></html>`);
  await mkdir(path.dirname(sheetPath), { recursive: true });
  await page.screenshot({ path: sheetPath, fullPage: true });
  console.log(`contact sheet: ${sheetPath}`);
}

await browser.close();
const total = written.reduce((s, w) => s + w.kb, 0);
console.log(`${written.length} files, ${total}KB total`);
