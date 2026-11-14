#!/usr/bin/env node
/**
 * Generative project covers (GLACIER / AFTERGLOW, docs/direction.md).
 *
 * Renders one seeded composition per project with three.js in headless
 * Chromium: real transmissive ice-glass chips refracting a backdrop of
 * cold paper (WAKE) or night afterglow (DREAM), soft fog, a faint 12-col
 * grid, the title as a large watermark in the display type, and the
 * project's tool logos as small embossed glyphs. Seed = hash(slug), so
 * every run reproduces the same covers.
 *
 * Writes per project, into <out>/<slug>/:
 *   cover.webp  cover-800.webp  cover-dream.webp  cover-dream-800.webp
 *
 * Usage:
 *   npm run gen:covers                      (writes to public/projects)
 *   npm run gen:covers -- --out <dir>       (e.g. a review folder)
 *   npm run gen:covers -- --only pixel-plus
 *   npm run gen:covers -- --sheet           (also writes contact-sheet.png)
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

/* ── CLI ────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = path.resolve(ROOT, argVal("--out") ?? "public/projects");
const only = argVal("--only");
const wantSheet = args.includes("--sheet");

/* ── Project inputs ─────────────────────────────────────────────── */

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

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = {
  wake: {
    bg: "#E9E7E2",
    grid: "rgba(26,26,30,0.075)",
    title: "rgba(26,26,30,0.085)",
    fog: "255,255,255",
    fogA: [0.10, 0.20],
    embossFace: "#E3E1DB",
    embossHi: "rgba(255,255,255,0.95)",
    embossLo: "rgba(26,26,30,0.24)",
    chip: "#f6fafc",
    atten: "#d6e8ee",
    attenDist: 9,
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
    embossFace: "#0c0b36",
    embossHi: "rgba(196,181,253,0.38)",
    embossLo: "rgba(0,0,0,0.6)",
    chip: "#ebe6ff",
    atten: "#c9bcf5",
    attenDist: 7,
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

function radial(g, x, y, r, color) {
  const grd = g.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, color);
  grd.addColorStop(1, color.replace(/[\\d.]+\\)$/, "0)"));
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawTitle(g, lines, p, rng) {
  g.save();
  g.fillStyle = p.title;
  g.textBaseline = "alphabetic";
  // Size so the caps line spans most of the frame, bleeding is allowed
  g.font = "800 100px Geist";
  g.letterSpacing = "-4px";
  const w100 = g.measureText(lines.caps).width || 1;
  const size = Math.min(((W * 0.9) / w100) * 100, 400);
  const top = H * (0.24 + rng() * 0.08);
  g.font = "800 " + size + "px Geist";
  g.letterSpacing = -0.04 * size + "px";
  g.fillText(lines.caps, MARGIN - size * 0.05, top + size * 0.72);
  if (lines.accent) {
    const indent = MARGIN + size * (0.35 + rng() * 0.9);
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
}

function drawGlyphs(g, icons, p) {
  const size = 34, gap = 26;
  let x = MARGIN;
  const y = H - MARGIN - size;
  for (const icon of icons) {
    const path = new Path2D(icon.path);
    const draw = (dx, dy, fill) => {
      g.save();
      g.translate(x + dx, y + dy);
      g.scale(size / 24, size / 24);
      g.fillStyle = fill;
      g.fill(path);
      g.restore();
    };
    draw(1.4, 1.4, p.embossLo);
    draw(-1.1, -1.1, p.embossHi);
    draw(0, 0, p.embossFace);
    x += size + gap;
  }
}

function grain(g, rng, alpha) {
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const tg = t.getContext("2d");
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

function paintBackdrop(mode, o) {
  const p = PALETTE[mode];
  const rng = mulberry32(o.seed ^ 0x9e3779b9);
  const c = document.createElement("canvas");
  c.width = W * SS; c.height = H * SS;
  const g = c.getContext("2d");
  g.scale(SS, SS);
  g.fillStyle = p.bg;
  g.fillRect(0, 0, W, H);

  const fx = 0.55 + rng() * 0.25, fy = 0.3 + rng() * 0.3;
  if (mode === "wake") {
    radial(g, W * 0.15, H * 0.05, 950, "rgba(255,255,255,0.6)");
    radial(g, W * 0.92, H * 1.05, 820, "rgba(200,220,230,0.38)");
  } else {
    radial(g, fx * W, fy * H, 780, "rgba(124,92,255,0.40)");
    radial(g, (1 - fx) * W, H * 0.98, 720, "rgba(48,36,150,0.50)");
    radial(g, fx * W, fy * H, 280, "rgba(236,190,255,0.20)");
  }

  // Faint 12-col grid with the site's margins, plus two hairline rules
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

  drawTitle(g, o.lines, p, mulberry32(o.seed));

  // Soft fog
  for (let k = 0; k < 7; k++) {
    const a = p.fogA[0] + rng() * (p.fogA[1] - p.fogA[0]);
    radial(g, rng() * W, rng() * H, 260 + rng() * 460, "rgba(" + p.fog + "," + a.toFixed(3) + ")");
  }

  drawGlyphs(g, o.icons, p);
  grain(g, rng, mode === "wake" ? 0.035 : 0.05);
  return { canvas: c, focal: { x: fx, y: fy } };
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
// Same idea as the site crystal's Lightformer rig: a black field with a
// few bright strips, so glass reads through crisp dark/bright facet edges
// instead of washing out against pale paper
function stripEnvironment() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  const strip = (w, h, pos, rot, rgb, k) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  // Camera-side strips: faces turned toward the viewer reflect +z
  strip(9, 1.4, [3, 4, 6], [0, 0, 0], [1, 1, 1], 3.4);
  strip(7, 0.9, [-5, 2, 5], [0, 0, 0], [1, 1, 1], 2.6);
  strip(10, 1.0, [0, -4, 5], [0, 0, 0], [1, 1, 1], 1.6);
  strip(2.5, 5, [6, -1, 3], [0, 0, 0], [0.63, 0.94, 0.94], 1.6);
  strip(2.5, 5, [-6, -1, 2], [0, 0, 0], [0.94, 0.69, 0.78], 1.3);
  strip(8, 1.2, [2, 5, -4], [0, 0, 0], [1, 1, 1], 1.5);
  return s;
}
const envTex = new THREE.PMREMGenerator(renderer).fromScene(stripEnvironment(), 0.02).texture;

const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
camera.position.set(0, 0, 10);
const viewH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(15));
const viewW = viewH * (W / H);

function buildChips(seed, focal) {
  const rng = mulberry32(seed ^ 0x85ebca6b);
  const count = 8 + Math.floor(rng() * 5);
  const fx = (focal.x - 0.5) * viewW, fy = (0.5 - focal.y) * viewH;
  const chips = [];
  for (let i = 0; i < count; i++) {
    const size = i === 0 ? 1.15 + rng() * 0.35 : i < 3 ? 0.5 + rng() * 0.35 : 0.1 + rng() * 0.22;
    const sx = 1, sy = 0.6 + rng() * 0.7, sz = 0.35 + rng() * 0.35;
    const pts = [];
    const n = 10 + Math.floor(rng() * 7);
    for (let k = 0; k < n; k++) {
      const th = Math.acos(2 * rng() - 1), ph = 2 * Math.PI * rng();
      const r = 0.7 + rng() * 0.3;
      pts.push(new THREE.Vector3(
        r * Math.sin(th) * Math.cos(ph) * sx * size,
        r * Math.sin(th) * Math.sin(ph) * sy * size,
        r * Math.cos(th) * sz * size,
      ));
    }
    const geo = new ConvexGeometry(pts);
    let x = fx, y = fy;
    if (i > 0) {
      const a = rng() * Math.PI * 2;
      const d = (0.7 + rng() * 2.4) * (i < 3 ? 0.75 : 1.15);
      x = fx + Math.cos(a) * d * 1.3;
      y = fy + Math.sin(a) * d * 0.8;
    }
    // Close to the paper so contact shadows stay tight
    const z = 0.35 + size * 0.45 + rng() * 0.3;
    const rot = [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI];
    chips.push({ geo, pos: [x, y, z], rot });
  }
  return chips;
}

window.renderCover = async (o) => {
  await document.fonts.load("800 100px Geist");
  await document.fonts.load("italic 400 100px Newsreader");
  const results = {};
  let chips = null;
  for (const mode of ["wake", "dream"]) {
    const p = PALETTE[mode];
    const { canvas, focal } = paintBackdrop(mode, o);
    if (!chips) chips = buildChips(o.seed, focal);

    const scene = new THREE.Scene();
    scene.environment = envTex;
    scene.environmentIntensity = p.env;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(viewW, viewH),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
    );
    scene.add(plane);

    // Hard-ish contact shadows on the paper ("cold paper, hard shadows")
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(viewW, viewH),
      new THREE.ShadowMaterial({ opacity: p.shadow }),
    );
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
      const rim = new THREE.PointLight(0xa894ff, 30, 12);
      rim.position.set((focal.x - 0.5) * viewW + 2, (0.5 - focal.y) * viewH + 1.5, 3);
      scene.add(rim);
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: p.chip,
      transmission: 1,
      thickness: 1.8,
      roughness: 0.03,
      ior: 1.5,
      dispersion: 4,
      attenuationColor: p.atten,
      attenuationDistance: p.attenDist,
      specularIntensity: 0.8,
      clearcoat: 0.25,
      clearcoatRoughness: 0.08,
      emissive: p.glow,
      emissiveIntensity: p.glowK,
      flatShading: true,
    });
    // Hairline facet edges: the specimen-drawing read that keeps clear
    // ice legible on pale paper
    const edgeMat = new THREE.LineBasicMaterial({
      color: p.edge,
      transparent: true,
      opacity: p.edgeA,
      toneMapped: false,
    });
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

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const og = out.getContext("2d");
    og.imageSmoothingQuality = "high";
    og.drawImage(glCanvas, 0, 0, W, H);
    const small = document.createElement("canvas");
    small.width = 800; small.height = 500;
    const sg = small.getContext("2d");
    sg.imageSmoothingQuality = "high";
    sg.drawImage(out, 0, 0, 800, 500);
    results[mode] = {
      full: out.toDataURL("image/webp", 0.86),
      small: small.toDataURL("image/webp", 0.82),
    };

    tex.dispose();
    mat.dispose();
  }
  return results;
};
window.__ready = true;
</script></body></html>`;

/* ── Run ────────────────────────────────────────────────────────── */

const MIME = { ".js": "text/javascript", ".html": "text/html" };

const launchOpts = {
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
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

for (const project of projects) {
  if (only && project.slug !== only) continue;
  const seed = hashSlug(project.slug);
  const t0 = Date.now();
  const res = await page.evaluate((o) => window.renderCover(o), {
    seed,
    lines: titleLines(project),
    icons: iconsFor(project),
  });
  const dir = path.join(outDir, project.slug);
  await mkdir(dir, { recursive: true });
  const files = {
    "cover.webp": res.wake.full,
    "cover-800.webp": res.wake.small,
    "cover-dream.webp": res.dream.full,
    "cover-dream-800.webp": res.dream.small,
  };
  for (const [name, data] of Object.entries(files)) {
    const buf = decode(data);
    await writeFile(path.join(dir, name), buf);
    written.push({ slug: project.slug, name, kb: Math.round(buf.length / 1024), data });
  }
  console.log(`${project.slug}  seed=${seed}  ${Date.now() - t0}ms`);
}

if (wantSheet) {
  const rows = projects
    .filter((p) => !only || p.slug === only)
    .map((p) => {
      const pick = (n) => written.find((w) => w.slug === p.slug && w.name === n);
      const wake = pick("cover.webp"), dream = pick("cover-dream.webp");
      return `<div class="row"><div class="label">${p.title}<span>${p.slug} · wake ${wake.kb}KB · dream ${dream.kb}KB</span></div>
        <img src="${wake.data}"><img src="${dream.data}"></div>`;
    })
    .join("");
  await page.setViewportSize({ width: 1640, height: 600 });
  await page.setContent(`<!doctype html><html><head><style>
    body{margin:0;padding:24px;background:#111;color:#ddd;font:14px ui-monospace,monospace}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
    .label{grid-column:1/3;font-size:16px;color:#fff}
    .label span{margin-left:12px;color:#999;font-size:13px}
    img{width:100%;display:block;border-radius:2px}
  </style></head><body>${rows}</body></html>`);
  const sheet = path.join(outDir, "contact-sheet.png");
  await page.screenshot({ path: sheet, fullPage: true });
  console.log(`contact sheet: ${sheet}`);
}

await browser.close();
for (const w of written) console.log(`  ${w.slug}/${w.name}  ${w.kb}KB`);
