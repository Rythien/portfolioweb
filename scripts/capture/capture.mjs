#!/usr/bin/env node
// Project footage: drives a project's own dev server with Playwright (Edge,
// headless, real GPU) and records it through a CDP screencast.
//
//   node scripts/capture/capture.mjs scripts/capture/<slug>.json [--only=preview,walkthrough,stills] [--keep-frames]
//
// Everything about a project lives in its JSON: how to start the server,
// files to restore afterwards, page set-up (storage, CSS, text masking,
// image swaps) and three beat lists. Output goes to public/projects/<slug>/:
//   preview.mp4 / .webm / -poster.webp      panel loop, seconds from the config (< 2 MB)
//   walkthrough.mp4 / .webm / -poster.webp  captioned, 25-40 s  (< 8 MB)
//   still-<name>.webp                       gallery stills
//
// Beats ({ "do": ..., ... }):
//   goto   url [wait]               navigate (relative to base)
//   wait   ms
//   scroll to|by [ms] [offset]      smooth wheel scroll; to = px or selector
//   jump   to [offset] [settle]     instant scroll, recording paused (a cut)
//   cut    on|off                   pause / resume recording by hand
//   move   to [ms]                  glide the cursor to a selector or [x,y]
//   click  sel [ms] [nth]           glide there, then click
//   hover  sel [ms]
//   type   sel text [delay]
//   key    key
//   drag   from to|by [ms]          press, glide, release (selectors or [x,y])
//   caption text|null [label]       walkthrough overlay; null hides it
//   still  name [hide]              stills run: save still-<name>.webp
//   eval   js                       escape hatch, runs in the page
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, renameSync, statSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const cfgPath = args.find((a) => !a.startsWith("--"));
if (!cfgPath) throw new Error("usage: capture.mjs <config.json> [--only=preview,walkthrough,stills]");
const only = (args.find((a) => a.startsWith("--only="))?.slice(7) ?? "preview,walkthrough,stills").split(",");
const keepFrames = args.includes("--keep-frames");
const cfg = JSON.parse(readFileSync(resolve(cfgPath), "utf8"));
// Anything that would identify a client (its name in masking rules, a
// local path) lives in <config>.local.json beside it, which is gitignored.
// Its server list replaces the config's; its routes and replace rules run
// before the config's own.
const localPath = resolve(cfgPath).replace(/\.json$/, ".local.json");
if (existsSync(localPath)) {
  const local = JSON.parse(readFileSync(localPath, "utf8"));
  if (local.server) cfg.server = local.server;
  cfg.init = { ...cfg.init };
  for (const key of ["routes", "replace"]) {
    if (local.init?.[key]) cfg.init[key] = [...local.init[key], ...(cfg.init[key] ?? [])];
  }
} else if (cfg.requiresLocal) {
  throw new Error(`${cfg.slug} needs ${localPath} (client masking rules, kept out of git)`);
}
const [W, H] = cfg.viewport ?? [1600, 1000];
const FPS = cfg.fps ?? 30;
const OUT = resolve(ROOT, cfg.out ?? `public/projects/${cfg.slug}`);
const WORK = join(tmpdir(), `capture-${cfg.slug}`);
mkdirSync(OUT, { recursive: true });

const log = (...m) => console.log(`[${cfg.slug}]`, ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- server ---------- */

async function up(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function startServers() {
  const list = [].concat(cfg.server ?? []);
  const kids = [];
  for (const s of list) kids.push(await startServer(s));
  return kids;
}

async function startServer(s) {
  const ready = [].concat(s.ready);
  if ((await Promise.all(ready.map(up))).every(Boolean)) {
    log("server already running, reusing it");
    return null;
  }
  log("starting", s.cmd, (s.args ?? []).join(" "));
  const child = spawn(s.cmd, s.args ?? [], {
    cwd: s.cwd,
    env: { ...process.env, ...(s.env ?? {}) },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  const t0 = Date.now();
  while (!(await Promise.all(ready.map(up))).every(Boolean)) {
    if (Date.now() - t0 > (s.timeout ?? 90000)) throw new Error(`server not ready:\n${out.slice(-2000)}`);
    await sleep(500);
  }
  // First hit compiles on dev servers; warm every ready URL once more.
  await Promise.all(ready.map(up));
  return child;
}

function stopServer(child) {
  if (!child) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  } catch {}
}

/* ---------- page set-up ---------- */

// Runs before any page script: storage, masking, the cursor and caption layers.
function initScript({ init = {}, cursor, captions }) {
  return `(() => {
    const init = ${JSON.stringify(init)};
    try {
      for (const [k, v] of Object.entries(init.localStorage || {})) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      for (const [k, v] of Object.entries(init.sessionStorage || {})) sessionStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch {}
    const rules = (init.replace || []).map(([p, f, w]) => [new RegExp(p, f), w]);
    const swap = (s) => {
      for (const [re, w] of rules) s = s.replace(re, (m) => (m === m.toUpperCase() && /[A-Z]/.test(m) ? w.toUpperCase() : w));
      return s;
    };
    const ATTRS = ["placeholder", "alt", "title", "aria-label", "value"];
    const scrub = (root) => {
      if (!rules.length || !root) return;
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = tw.nextNode()); ) { const v = swap(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
      const els = root.querySelectorAll ? root.querySelectorAll("*") : [];
      for (const el of [root, ...els]) {
        if (!el.getAttribute) continue;
        for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const s = swap(v); if (s !== v) el.setAttribute(a, s); } }
        if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && el.value) { const s = swap(el.value); if (s !== el.value) el.value = s; }
      }
      if (document.title) { const t = swap(document.title); if (t !== document.title) document.title = t; }
    };
    const boot = () => {
      if (init.css) { const st = document.createElement("style"); st.textContent = init.css; document.head.appendChild(st); }
      scrub(document.body);
      if (rules.length) new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") scrub(m.target.parentNode); else for (const n of m.addedNodes) scrub(n.nodeType === 3 ? n.parentNode : n); if (m.type === "attributes") scrub(m.target); } })
        .observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      if (${!!cursor}) {
        const c = document.createElement("div");
        c.id = "__cap-cursor";
        c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.92);border:1.5px solid rgba(0,0,0,.55);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;z-index:2147483647;transition:transform .12s ease,opacity .2s;transform:translate(-100px,-100px);opacity:0";
        let x = -100, y = -100, s = 1;
        const paint = () => (c.style.transform = "translate(" + x + "px," + y + "px) scale(" + s + ")");
        addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; c.style.opacity = 1; paint(); }, true);
        addEventListener("mousedown", () => { s = 0.7; paint(); }, true);
        addEventListener("mouseup", () => { s = 1; paint(); }, true);
        document.documentElement.appendChild(c);
      }
      if (${!!captions}) {
        const box = document.createElement("div");
        box.id = "__cap-caption";
        box.style.cssText = "position:fixed;left:48px;bottom:44px;max-width:640px;padding:16px 20px 18px;border-radius:14px;background:rgba(12,12,14,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#f4f2ee;font:500 21px/1.35 ui-sans-serif,system-ui,'Segoe UI',sans-serif;letter-spacing:-.005em;z-index:2147483646;pointer-events:none;opacity:0;transform:translateY(8px);transition:opacity .35s ease,transform .35s ease;box-shadow:0 10px 40px rgba(0,0,0,.3)";
        box.innerHTML = '<div style="font:600 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;opacity:.6;margin-bottom:9px"></div><div></div>';
        document.documentElement.appendChild(box);
        window.__capCaption = (text, label) => {
          if (!text) { box.style.opacity = 0; box.style.transform = "translateY(8px)"; return; }
          box.firstChild.textContent = label || "";
          box.firstChild.style.display = label ? "block" : "none";
          box.lastChild.textContent = text;
          box.style.opacity = 1; box.style.transform = "none";
        };
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  })();`;
}

/* ---------- recording ---------- */

class Recorder {
  constructor(page, dir) {
    this.page = page;
    this.dir = dir;
    this.frames = []; // { file, t } or { pause: t } / { resume: t }
    this.paused = false;
    this.resumedAt = 0;
  }
  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    let n = 0;
    // Frames arrive over CDP in bursts, so time them by Chrome's own swap
    // timestamp (epoch seconds), not by when they reach us.
    this.cdp.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
      const t = metadata?.timestamp ? metadata.timestamp * 1000 : Date.now();
      this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      if (this.paused || this.stopped || t < this.resumedAt) return;
      const file = join(this.dir, `f${String(n++).padStart(6, "0")}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      this.frames.push({ file, t });
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    this.t0 = Date.now();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.frames.push({ pause: Date.now() });
  }
  async resume() {
    if (!this.paused) return;
    // Hold until a fresh frame of the new state lands, so the cut is clean.
    this.resumedAt = Date.now();
    this.frames.push({ resume: this.resumedAt });
    this.paused = false;
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  async stop() {
    this.end = Date.now();
    this.stopped = true;
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    await sleep(100);
  }
  // ffconcat list with each frame held until the next one (pauses removed).
  concat() {
    const lines = ["ffconcat version 1.0"];
    const key = (x) => x.t ?? x.pause ?? x.resume;
    const list = [...this.frames].sort((x, y) => key(x) - key(y));
    let total = 0;
    let last = null;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f.file) continue;
      const next = list.slice(i + 1).find((x) => x.file || x.pause);
      const until = next ? next.pause ?? next.t : this.end;
      const d = Math.max(0.001, (until - f.t) / 1000);
      lines.push(`file '${f.file.replace(/\\/g, "/")}'`, `duration ${d.toFixed(4)}`);
      total += d;
      last = f;
    }
    if (last) lines.push(`file '${last.file.replace(/\\/g, "/")}'`);
    const p = join(this.dir, "list.ffconcat");
    writeFileSync(p, lines.join("\n"));
    return { list: p, seconds: total };
  }
}

/* ---------- beats ---------- */

async function box(page, target, nth = 0) {
  if (Array.isArray(target)) return { x: target[0], y: target[1] };
  const loc = page.locator(target).nth(nth);
  await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  const b = await loc.boundingBox({ timeout: 8000 });
  if (!b) throw new Error(`no box for ${target}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let mouse = { x: W * 0.62, y: H * 0.55 };

// Time-based, not step-based: each CDP round trip is slow while the
// screencast streams, so a fixed step count would stretch the motion.
async function glide(page, to, ms = 700) {
  const from = { ...mouse };
  const t0 = Date.now();
  for (;;) {
    const k = ease(Math.min(1, (Date.now() - t0) / ms));
    mouse = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    await page.mouse.move(mouse.x, mouse.y);
    if (k >= 1) break;
    await sleep(12);
  }
}

async function scrollTarget(page, b) {
  if (typeof b.to === "number") return b.to;
  return page.evaluate(([sel, off]) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("no " + sel);
    return el.getBoundingClientRect().top + scrollY - (off || 0);
  }, [b.to, b.offset ?? 0]);
}

async function run(page, beats, ctx) {
  for (const b of beats) {
    const t0 = Date.now();
    await beat(page, b, ctx);
    if (process.env.CAPTURE_TRACE) log(`  ${b.do} ${b.sel ?? b.to ?? b.url ?? b.text ?? b.name ?? ""} ${Date.now() - t0} ms`);
  }
}

async function beat(page, b, ctx) {
  {
    switch (b.do) {
      case "goto":
        if (ctx.rec && b.cut !== false && ctx.started) ctx.rec.pause();
        await page.goto(new URL(b.url, cfg.base).href, { waitUntil: "load", timeout: 90000 });
        await sleep(b.wait ?? 1500);
        if (ctx.rec) await ctx.rec.resume();
        break;
      case "wait":
        await sleep(b.ms);
        break;
      case "scroll": {
        const cur = await page.evaluate(() => scrollY);
        const dy = b.by ?? (await scrollTarget(page, b)) - cur;
        const ms = b.ms ?? 1200;
        const t0 = Date.now();
        let done = 0;
        for (;;) {
          const k = Math.min(1, (Date.now() - t0) / ms);
          const want = Math.round(dy * ease(k));
          if (want !== done) await page.mouse.wheel(0, want - done);
          done = want;
          if (k >= 1) break;
          await sleep(20);
        }
        await sleep(b.settle ?? 400);
        break;
      }
      case "jump": {
        ctx.rec?.pause();
        const y = await scrollTarget(page, b);
        // A smooth-scroll library keeps its own target and eases back to
        // it after a bare scrollTo (while a wheel scroll is still easing,
        // it ignores native scrolls). Move it directly when the page
        // exposes it, and re-apply until the position holds: the recording
        // is paused, so none of this is seen
        const place = () =>
          page.evaluate((y) => {
            const lenis = window.__novaLenis ?? window.lenis ?? window.__lenis;
            if (lenis?.scrollTo) lenis.scrollTo(y, { immediate: true, force: true });
            else window.scrollTo({ top: y, behavior: "instant" });
            return Math.round(window.scrollY);
          }, y);
        // The page can't scroll past its end, so hold against the reachable y
        const want = await page.evaluate((y) => Math.round(Math.min(y, document.documentElement.scrollHeight - innerHeight)), y);
        const t0 = Date.now();
        let held = 0;
        await place();
        while (held < 3 && Date.now() - t0 < 4000) {
          await sleep(120);
          const at = await page.evaluate(() => Math.round(window.scrollY));
          if (Math.abs(at - want) <= 2) held++;
          else {
            held = 0;
            await place();
          }
        }
        if (held < 3) log(`WARNING jump to ${b.to} did not hold at ${want}`);
        await sleep(b.settle ?? 900);
        await ctx.rec?.resume();
        break;
      }
      case "cut":
        if (b.on === false || b.off) await ctx.rec?.resume();
        else ctx.rec?.pause();
        break;
      case "move":
        await glide(page, await box(page, b.to, b.nth), b.ms ?? 700);
        await sleep(b.after ?? 150);
        break;
      case "click": {
        const p = await box(page, b.sel, b.nth);
        await glide(page, p, b.ms ?? 650);
        await sleep(120);
        await page.mouse.down();
        await sleep(90);
        await page.mouse.up();
        await sleep(b.after ?? 700);
        break;
      }
      case "hover":
        await glide(page, await box(page, b.sel, b.nth), b.glide ?? 650);
        await sleep(b.ms ?? 800);
        break;
      case "type": {
        const p = await box(page, b.sel, b.nth);
        await glide(page, p, 550);
        await page.mouse.click(p.x, p.y);
        if (b.clear) await page.locator(b.sel).nth(b.nth ?? 0).fill("");
        await page.keyboard.type(b.text, { delay: b.delay ?? 85 });
        await sleep(b.after ?? 600);
        break;
      }
      case "key":
        await page.keyboard.press(b.key);
        await sleep(b.after ?? 400);
        break;
      case "drag": {
        const from = await box(page, b.from, b.nth);
        await glide(page, from, 600);
        await page.mouse.down();
        await sleep(150);
        const to = b.by ? { x: from.x + b.by[0], y: from.y + b.by[1] } : await box(page, b.to);
        await glide(page, to, b.ms ?? 1200);
        await sleep(120);
        await page.mouse.up();
        await sleep(b.after ?? 600);
        break;
      }
      case "caption":
        if (ctx.captions) await page.evaluate(([t, l]) => window.__capCaption?.(t, l), [b.text ?? null, b.label ?? cfg.captionLabel ?? ""]);
        await sleep(b.hold ?? 0);
        break;
      case "still": {
        if (!ctx.stills) break;
        await page.mouse.move(-50, -50);
        await sleep(b.settle ?? 600);
        const png = join(WORK, `still-${b.name}.png`);
        await page.screenshot({ path: png });
        const webp = join(OUT, `still-${b.name}.webp`);
        ff(["-i", png, "-c:v", "libwebp", "-quality", "86", "-compression_level", "6", webp]);
        ctx.made.push(webp);
        break;
      }
      case "eval":
        await page.evaluate(b.js);
        await sleep(b.after ?? 300);
        break;
      default:
        throw new Error(`unknown beat ${b.do}`);
    }
  }
}

/* ---------- encoding ---------- */

function ff(a) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { stdio: ["ignore", "inherit", "inherit"] });
}

// Panel loops hold quality and give up resolution: CRF 26 (VP9 38) at
// full size first, then smaller steps of the frame until under budget.
// Walkthroughs keep the old ladder (raise CRF, full size).
const PREVIEW_SCALES = [1, 0.9, 0.8, 0.7, 0.6];

function encode(name, list, { seconds, exact, budget, posterAt = 0.6, preview = false }) {
  const mp4 = join(OUT, `${name}.mp4`);
  const webm = join(OUT, `${name}.webm`);
  const poster = join(OUT, `${name}-poster.webp`);
  const fit = exact ? `,tpad=stop_mode=clone:stop_duration=${exact},trim=duration=${exact}` : "";
  const vf = (k = 1) => {
    const w = Math.round((W * k) / 2) * 2, h = Math.round((H * k) / 2) * 2;
    return `fps=${FPS},scale=${w}:${h}:flags=lanczos${fit},format=yuv420p`;
  };
  const src = ["-f", "concat", "-safe", "0", "-i", list];
  const x264 = (crf, k) => ff([...src, "-vf", vf(k), "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
  const vp9 = (crf, k) => ff([...src, "-vf", vf(k), "-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-deadline", "good", "-cpu-used", "3", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an", webm]);
  let crf, vcrf, k = 1, vk = 1;
  if (preview) {
    crf = 26;
    vcrf = 38;
    for (k of PREVIEW_SCALES) {
      x264(crf, k);
      if (statSync(mp4).size <= budget) break;
      log(`${name}.mp4 over ${(budget / 1e6).toFixed(0)} MB at ${Math.round(W * k)} px, trying smaller`);
    }
    for (vk of PREVIEW_SCALES) {
      vp9(vcrf, vk);
      if (statSync(webm).size <= budget) break;
    }
  } else {
    crf = 24;
    for (;;) {
      x264(crf);
      if (statSync(mp4).size <= budget || crf >= 32) break;
      crf += 2;
      log(`${name}.mp4 over ${(budget / 1e6).toFixed(0)} MB, retrying at CRF ${crf}`);
    }
    vcrf = 38;
    for (;;) {
      vp9(vcrf);
      if (statSync(webm).size <= budget || vcrf >= 50) break;
      vcrf += 4;
    }
  }
  ff(["-ss", String(posterAt), "-i", mp4, "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", poster]);
  const mb = (f) => (statSync(f).size / 1e6).toFixed(2);
  log(`${name}: ${(exact ?? seconds).toFixed(1)} s  mp4 ${mb(mp4)} MB (crf ${crf}, ${Math.round(W * k)} px)  webm ${mb(webm)} MB (crf ${vcrf}, ${Math.round(W * vk)} px)  poster ${mb(poster)} MB`);
  for (const f of [mp4, webm]) if (statSync(f).size > budget) log(`WARNING ${f.slice(OUT.length + 1)} still over budget`);
  return [mp4, webm, poster];
}

/* ---------- main ---------- */

// A restore cut short by a killed process once left a project file all
// zeros, so never back up a zeroed file over a good backup, and restore by
// copying beside the file and renaming over it (the rename is atomic).
const zeroed = (f) => readFileSync(f).subarray(0, 4096).every((b) => b === 0);
const preserved = (cfg.preserve ?? []).map((f) => {
  const bak = join(tmpdir(), `capture-preserve-${cfg.slug}-${f.replace(/\W+/g, "_")}`);
  if (zeroed(f)) throw new Error(`${f} is all zeros (an interrupted restore?); restore it from ${bak} first`);
  copyFileSync(f, bak);
  return { f, bak };
});
const restore = () =>
  preserved.forEach(({ f, bak }) => {
    copyFileSync(bak, f + ".restore-tmp");
    renameSync(f + ".restore-tmp", f);
  });

let server = null;
let browser = null;
const made = [];
try {
  server = await startServers();
  browser = await chromium.launch({
    headless: true,
    channel: cfg.channel ?? "msedge",
    args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required"],
  });

  for (const kind of ["preview", "walkthrough", "stills"]) {
    if (!only.includes(kind) || !cfg[kind]) continue;
    const spec = cfg[kind];
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: cfg.colorScheme ?? "light", reducedMotion: "no-preference" });
    for (const r of cfg.init?.routes ?? []) {
      await context.route(r.match, (route) => route.fulfill({ path: resolve(ROOT, r.file), contentType: r.contentType }));
    }
    await context.addInitScript(initScript({ init: cfg.init, cursor: kind !== "stills" && cfg.cursor !== false, captions: kind === "walkthrough" }));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    mouse = { x: W * 0.62, y: H * 0.55 };

    const ctx = { captions: kind === "walkthrough", stills: kind === "stills", made };
    if (kind === "stills") {
      await run(page, spec.beats, ctx);
    } else {
      // Set-up beats run unrecorded (first load, logins, warm-up).
      await run(page, spec.setup ?? [], ctx);
      await page.mouse.move(mouse.x, mouse.y);
      ctx.rec = new Recorder(page, join(WORK, kind));
      await ctx.rec.start();
      ctx.started = true;
      await run(page, spec.beats, ctx);
      await ctx.rec.stop();
      const { list, seconds } = ctx.rec.concat();
      const exact = kind === "preview" ? spec.seconds ?? 8 : undefined;
      if (kind === "walkthrough" && (seconds < 25 || seconds > 40)) log(`WARNING walkthrough runs ${seconds.toFixed(1)} s (want 25-40)`);
      if (kind === "preview" && seconds + 0.25 < exact) log(`WARNING preview has ${seconds.toFixed(1)} s of footage, padded to ${exact}`);
      if (kind === "preview" && seconds > exact + 0.25) log(`WARNING preview has ${seconds.toFixed(1)} s of footage, trimmed to ${exact}: the last beat is cut short`);
      if (kind === "preview") log(`preview footage ${seconds.toFixed(2)} s (target ${exact})`);
      made.push(...encode(kind, list, { seconds, exact, budget: kind === "preview" ? 2e6 : 8e6, posterAt: spec.posterAt, preview: kind === "preview" }));
      if (!keepFrames) rmSync(join(WORK, kind), { recursive: true, force: true });
    }
    if (errors.length) log("page errors:", errors.slice(0, 4).join(" | "));
    await context.close();
  }
} finally {
  await browser?.close();
  (server ?? []).forEach(stopServer);
  restore();
  if (preserved.length) log("restored", preserved.map((p) => p.f).join(", "));
}
log("wrote", made.map((f) => f.slice(ROOT.length + 1)).join("\n  "));
