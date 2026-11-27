#!/usr/bin/env node
// Stutter, not fps: rAF frame intervals over 20 s per scenario, with
// p50 / p95 / p99 and the count of frames over 32 ms (two missed vsyncs).
// Every long frame is logged with when it happened and what was going on
// (scroll position, mode, Archive open), so spikes can be traced.
//
// Scenarios: hero at rest; hero while wheel-scrolling the whole page (as a
// visitor: their first mouse move starts the Archive warm-up, which then
// runs during the scroll); the WAKE -> DREAM transition once that warm-up
// is done, and cold (clicked before any other interaction); Archive at
// spawn. hero-scroll-noarchive is the scroll with the Archive disabled.
// Run against a production build: `next build && next start -p 3100`.
// --gl also times the WebGL calls that can block the main thread (program
// link and status queries, shader compile, texture and buffer uploads) and
// lists every one over 20 ms, with what it was (shader size, texture size).
//   node scripts/perf/jank.mjs [base=http://localhost:3100] [--headed] [--only=name,...] [--long] [--gl]
import { firefox } from "playwright";
import { launch, session } from "../_browser.mjs";

const args = process.argv.slice(2);
const BASE = args.find((a) => a.startsWith("http")) ?? "http://localhost:3100";
const headed = args.includes("--headed");
const only = (args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? "").split(",").filter(Boolean);
const showLong = args.includes("--long");
const glTrace = args.includes("--gl");
const progTrace = args.includes("--programs");

/** Programs per canvas, by three cache key (src/components/scene/programHook.ts). */
const programKeys = (page) => page.evaluate(() => {
  const out = {};
  for (const [c, f] of Object.entries(window.__programs ?? {})) out[c] = f().map((p) => p.key);
  return out;
});

/** For a new key: the parameters that differ from its closest existing sibling. */
function explain(key, before) {
  const t = key.split(",");
  let best = null, bestD = Infinity;
  for (const k of before) {
    const u = k.split(",");
    if (u.length !== t.length) continue;
    let d = 0;
    for (let i = 0; i < t.length; i++) if (t[i] !== u[i]) d++;
    if (d < bestD) { bestD = d; best = u; }
  }
  const head = t[0].slice(0, 60);
  if (!best) return head + " (no sibling: new material type)";
  const diffs = [];
  for (let i = 0; i < t.length; i++) if (t[i] !== best[i]) diffs.push("#" + i + " " + best[i].slice(0, 40) + " -> " + t[i].slice(0, 40));
  return head + " | " + diffs.join("; ");
}
const WINDOW_MS = 20000;
const LONG_MS = 32;

/** In-page recorder: rAF intervals plus a context string per long frame. */
const RECORDER = `
window.__jank = { dts: [], long: [], t0: 0, last: 0, on: false };
window.__jankStart = () => {
  const j = window.__jank;
  j.dts = []; j.long = []; j.on = true; j.t0 = performance.now(); j.last = j.t0;
  const f = (now) => {
    if (!j.on) return;
    const dt = now - j.last; j.last = now; j.dts.push(dt);
    if (dt > ${LONG_MS}) {
      const html = document.documentElement;
      j.long.push({ at: Math.round(now - j.t0), dt: Math.round(dt),
        y: Math.round(window.scrollY), mode: html.dataset.mode ?? html.className.match(/\\b(wake|dream)\\b/)?.[1] ?? "?",
        archive: !!document.querySelector(".archive-canvas canvas") && getComputedStyle(document.querySelector(".archive-root") ?? document.body).visibility !== "hidden" });
    }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
};
window.__jankStop = () => { window.__jank.on = false; return window.__jank; };
`;

/** Optional: time the GL calls that can stall (sync program status, uploads). */
const GL_TRACE = `
window.__gl = [];
for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
  const P = C.prototype;
  const wrap = (name, describe) => {
    const orig = P[name];
    P[name] = function (...a) {
      const t = performance.now();
      const r = orig.apply(this, a);
      const dt = performance.now() - t;
      if (dt > 20) window.__gl.push({ at: Math.round(t - (window.__jank?.t0 || 0)), dt: Math.round(dt), call: name, what: describe ? describe.call(this, a) : "" });
      return r;
    };
  };
  const progInfo = function (a) {
    try {
      const sh = this.getAttachedShaders(a[0]) || [];
      const src = sh.map((x) => this.getShaderSource(x) || "").join(" ");
      const k = src.indexOf("#define SHADER_NAME ");
      const name = k < 0 ? "?" : src.slice(k + 20, src.indexOf(String.fromCharCode(10), k));
      const variant = src.includes("#define OPAQUE") ? "opaque" : "transparent";
      const canvas = this.canvas && this.canvas.closest && this.canvas.closest(".archive-canvas") ? "archive" : "page";
      const m = src.indexOf("for (float i = 0.0; i < ");
      const samples = m < 0 ? "" : " samples=" + parseInt(src.slice(m + 24), 10);
      return canvas + " " + name + " " + variant + samples + " " + src.length + " chars";
    } catch (e) { return "?" + e; }
  };
  wrap("linkProgram", progInfo);
  wrap("getProgramParameter", progInfo);
  wrap("getProgramInfoLog", progInfo);
  wrap("getShaderParameter");
  wrap("compileShader", function (a) { return (this.getShaderSource(a[0]) || "").length + " chars"; });
  wrap("useProgram");
  for (const n of ["texImage2D", "texSubImage2D", "texStorage2D", "texImage3D", "generateMipmap", "bufferData", "readPixels", "drawElements", "drawArrays"]) {
    wrap(n, function (a) { return a.length > 4 ? a.slice(3, 5).join("x") : ""; });
  }
}
`;

const SCENARIOS = [
  {
    name: "hero-rest",
    url: "/?nopreload=1&noarchive=1&mode=wake",
    settle: 8000,
    async run(page) { await page.waitForTimeout(WINDOW_MS); },
  },
  {
    name: "hero-scroll",
    url: "/?nopreload=1&mode=wake",
    settle: 8000,
    async run(page) {
      // Steady wheel input from the top to the bottom across the window
      const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const steps = Math.floor(WINDOW_MS / 50);
      const dy = Math.max(20, Math.ceil(total / (steps * 0.85)));
      await page.mouse.move(720, 450);
      const t0 = Date.now();
      while (Date.now() - t0 < WINDOW_MS) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(50);
      }
    },
  },
  {
    name: "hero-scroll-noarchive",
    url: "/?nopreload=1&noarchive=1&mode=wake",
    settle: 8000,
    async run(page) {
      // Steady wheel input from the top to the bottom across the window
      const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const steps = Math.floor(WINDOW_MS / 50);
      const dy = Math.max(20, Math.ceil(total / (steps * 0.85)));
      await page.mouse.move(720, 450);
      const t0 = Date.now();
      while (Date.now() - t0 < WINDOW_MS) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(50);
      }
    },
  },
  {
    name: "wake-to-dream",
    url: "/?nopreload=1&mode=wake",
    settle: 2000,
    // A visitor who has been on the page: an interaction, then the
    // Archive's warm-up allowed to finish before the click
    async before(page) {
      await page.mouse.move(400, 300);
      await page.mouse.move(700, 500);
      await page.waitForFunction(() => window.__archiveWarmMs !== undefined, null, { timeout: 120000 });
      await page.waitForTimeout(1000);
    },
    async run(page) {
      await page.getByRole("group", { name: "Site mode" }).getByRole("button", { name: /dream/i }).click();
      await page.waitForTimeout(WINDOW_MS);
    },
  },
  {
    name: "wake-to-dream-cold",
    url: "/?nopreload=1&mode=wake",
    settle: 8000,
    async run(page) {
      await page.getByRole("group", { name: "Site mode" }).getByRole("button", { name: /dream/i }).click();
      await page.waitForTimeout(WINDOW_MS);
    },
  },
  {
    name: "archive-spawn",
    url: "/?nopreload=1&mode=dream",
    settle: 5000,
    ready: true,
    async run(page) { await page.waitForTimeout(WINDOW_MS); },
  },
];

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];

await session(async () => {
  const browser = await launch(firefox, { firefoxUserPrefs: { "webgl.force-enabled": true, "privacy.reduceTimerPrecision": false } });
  for (const sc of SCENARIOS) {
    if (only.length && !only.includes(sc.name)) continue;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(RECORDER);
    if (glTrace) await ctx.addInitScript(GL_TRACE);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?nopreload=1&noarchive=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: [], recovered: [], hintSeen: true })));
    await page.goto(BASE + sc.url, { waitUntil: "load" });
    if (sc.ready) await page.waitForFunction(() => (window.__archiveFrames ?? 0) > 30, null, { timeout: 60000 });
    await page.waitForTimeout(sc.settle);
    if (sc.before) await sc.before(page);
    const progBefore = progTrace ? await programKeys(page) : null;
    await page.evaluate(() => window.__jankStart());
    await sc.run(page);
    const j = await page.evaluate(() => window.__jankStop());
    const d = [...j.dts].sort((a, b) => a - b);
    const over = j.dts.filter((x) => x > LONG_MS).length;
    console.log(`${sc.name.padEnd(14)} frames ${String(d.length).padStart(5)}  p50 ${pct(d, 0.5).toFixed(1).padStart(5)}  p95 ${pct(d, 0.95).toFixed(1).padStart(5)}  p99 ${pct(d, 0.99).toFixed(1).padStart(6)}  max ${d.at(-1).toFixed(0).padStart(5)} ms  >${LONG_MS}ms: ${over}`);
    if (showLong && j.long.length) for (const l of j.long) console.log(`    t=${String(l.at).padStart(6)} ms  ${String(l.dt).padStart(4)} ms  y=${l.y} mode=${l.mode} archive=${l.archive}`);
    if (progTrace) {
      const after = await programKeys(page);
      for (const [c, keys] of Object.entries(after)) {
        const before = progBefore[c] ?? [];
        const fresh = keys.filter((k) => !before.includes(k));
        console.log("    " + c + ": " + before.length + " programs before, " + fresh.length + " new during the window");
        for (const k of fresh) console.log("      + " + explain(k, before.length ? before : keys.filter((x) => x !== k)));
      }
    }
    if (glTrace) {
      const g = await page.evaluate(() => window.__gl.filter((x) => x.at >= 0));
      for (const x of g) console.log(`    gl t=${String(x.at).padStart(6)} ms  ${String(x.dt).padStart(5)} ms  ${x.call} ${x.what}`);
    }
    await ctx.close();
  }
});
