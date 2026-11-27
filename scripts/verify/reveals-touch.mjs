#!/usr/bin/env node
/**
 * Reveals finish on phones too: touch scrolling and orientation changes.
 *
 *   node scripts/verify/reveals-touch.mjs [--url=http://localhost:3000]
 *        [--widths=360,390,414] [--modes=wake,dream]
 *        [--scenarios=flings,rotate,rotate-mid]
 *
 * reveals.mjs wheels a mouse in Firefox. Phones scroll by touch (Lenis
 * leaves touch native) and rotate, which resizes the viewport and makes
 * ScrollTrigger re-measure every trigger. This runs Edge (Chromium) with
 * mobile emulation and real touch drags (CDP Input.dispatchTouchEvent;
 * synthesizeScrollGesture does not scroll in headless Edge here):
 *
 *   flings      fast flings to the bottom and back to the top
 *   rotate      load, fling to mid-page, rotate to landscape, fling on,
 *               rotate back, fling to the bottom and back
 *   rotate-mid  rotate while reveals are in flight (just after a fling)
 *
 * After each, every [data-reveal] element must be finished (opacity 1,
 * visible, no transform, no clip), as in reveals.mjs. Then, stepping
 * through the page, every section heading and statement must be fully
 * opaque (product of its ancestors' opacity) whenever it is on screen
 * below the header band: nothing may sit half-faded at rest.
 *
 * Anchors: jumping to each section and discipline row the way the nav does
 * (scrollIntoView, which honours scroll-margin) must leave its first line
 * of text below the whole header scrim (solid band plus fade), not in the
 * fade, where it reads as ghosted.
 */
import { chromium } from "playwright";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "360,390,414").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const scenarios = arg("scenarios", "flings,rotate,rotate-mid").split(",");
const HEIGHTS = { 360: 780, 390: 844, 414: 896 };

await session(async () => {
  const browser = await launch(chromium, { channel: "msedge", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  let failures = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? "✓" : "✗"} ${msg}`);
    if (!ok) failures++;
  };

  const audit = (page) =>
    page.evaluate(() => {
      const bad = [];
      const els = [...document.querySelectorAll("[data-reveal]")];
      for (const el of els) {
        const cs = getComputedStyle(el);
        const m = cs.transform === "none" ? null : new DOMMatrix(cs.transform);
        const moved = m && !(Math.abs(m.a - 1) < 1e-3 && Math.abs(m.d - 1) < 1e-3 && Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3 && Math.abs(m.e) < 0.5 && Math.abs(m.f) < 0.5);
        const clip = cs.clipPath.replace(/\s+/g, " ");
        const clipped = clip !== "none" && !/^inset\(0(%|px)?( 0(%|px)?){0,3}\)$/.test(clip);
        if (parseFloat(cs.opacity) < 0.999 || cs.visibility !== "visible" || moved || clipped) {
          const label = (el.textContent || el.className || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
          bad.push(`${label} [opacity ${cs.opacity}, ${cs.visibility}, transform ${cs.transform.slice(0, 30)}, clip ${clip}]`);
        }
      }
      return { count: els.length, bad };
    });

  // Headings and statements: on screen below the header band, fully opaque
  const ghosts = (page) =>
    page.evaluate(() => {
      const out = [];
      const band = 108;
      const sel = "main h1, main h2, main h3, main [data-word], main .text-display";
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 || r.top < band || r.bottom > innerHeight) continue;
        let o = 1;
        for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
        if (o < 0.999) out.push(`${el.textContent.trim().slice(0, 30)} at y=${Math.round(r.top)} opacity ${o.toFixed(2)}`);
      }
      return out;
    });

  // Fast touch drags (60% of the screen in ~100ms each, so they fling)
  // until the page has moved dy or stopped moving
  const fling = async (cdp, page, dy, w, h) => {
    const x = Math.round(w * 0.85);
    const span = Math.round(h * 0.6);
    const target = (await page.evaluate(() => scrollY)) + dy;
    for (let i = 0; i < 80; i++) {
      const y0 = await page.evaluate(() => scrollY);
      if (dy > 0 ? y0 >= target : y0 <= target) break;
      const [a, z] = dy > 0 ? [h * 0.8, h * 0.8 - span] : [h * 0.2, h * 0.2 + span];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: Math.round(a) }] });
      for (let s = 1; s <= 6; s++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: Math.round(a + ((z - a) * s) / 6) }] });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(60);
      if ((await page.evaluate(() => scrollY)) === y0) break; // at an end
    }
    await page.waitForTimeout(200);
  };
  const scrollMax = (page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);

  for (const mode of modes) {
    for (const w of widths) {
      const h = HEIGHTS[w] ?? 844;
      for (const scenario of scenarios) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
        await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
        await page.waitForTimeout(2500);
        const rotate = async (land) => {
          await page.setViewportSize(land ? { width: h, height: w } : { width: w, height: h });
          await page.waitForTimeout(900);
        };
        if (scenario === "flings") {
          await fling(cdp, page, (await scrollMax(page)) + 2000, w, h);
          const [y, max] = await page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight]);
          check(y >= max - 20, `${mode} ${w}px touch reached the bottom (${Math.round(y)} of ${max})`);
          await fling(cdp, page, -((await scrollMax(page)) + 2000), w, h);
        } else if (scenario === "rotate") {
          await fling(cdp, page, (await scrollMax(page)) * 0.4, w, h);
          await page.waitForTimeout(800);
          await rotate(true);
          await fling(cdp, page, 1500, h, w);
          await rotate(false);
          await fling(cdp, page, (await scrollMax(page)) + 2000, w, h);
          await fling(cdp, page, -((await scrollMax(page)) + 2000), w, h);
        } else {
          await fling(cdp, page, (await scrollMax(page)) * 0.3, w, h);
          await rotate(true);
          await rotate(false);
          await fling(cdp, page, (await scrollMax(page)) + 2000, w, h);
          await fling(cdp, page, -((await scrollMax(page)) + 2000), w, h);
        }
        await page.waitForTimeout(1500);
        const r = await audit(page);
        const tag = `${mode} ${w}px ${scenario}`;
        check(r.count > 0 && r.bad.length === 0, `${tag}: ${r.count} reveals, ${r.bad.length} not finished`);
        for (const b of r.bad.slice(0, 6)) console.log(`    ${b}`);
        // Step down the page and look for anything half-faded at rest
        const max = await scrollMax(page);
        const seen = new Set();
        for (let y = 0; y <= max; y += Math.round(h * 0.5)) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await page.waitForTimeout(250);
          for (const g of await ghosts(page)) seen.add(g.replace(/ at y=\d+/, ""));
        }
        check(seen.size === 0, `${tag}: no heading half-faded at rest`);
        for (const g of [...seen].slice(0, 6)) console.log(`    ${g}`);
        if (scenario === "flings") {
          await page.evaluate(() => window.scrollTo(0, 400));
          await page.waitForTimeout(400);
          const ids = await page.evaluate(() => ["about", "disciplines", "works", "contact", ...[...document.querySelectorAll(".discipline-row[id]")].map((e) => e.id)]);
          const low = [];
          for (const id of ids) {
            await page.evaluate((id) => document.getElementById(id).scrollIntoView(), id);
            await page.waitForTimeout(700);
            const m = await page.evaluate((id) => {
              const s = getComputedStyle(document.querySelector(".header-scrim"));
              const edge = parseFloat(s.getPropertyValue("--scrim-solid")) + parseFloat(s.getPropertyValue("--scrim-fade"));
              const walk = document.createTreeWalker(document.getElementById(id), NodeFilter.SHOW_TEXT);
              for (let n = walk.nextNode(); n; n = walk.nextNode()) {
                if (!n.textContent.trim()) continue;
                const r = document.createRange();
                r.selectNodeContents(n);
                const rect = [...r.getClientRects()].find((q) => q.width > 0);
                if (rect) return { top: Math.round(rect.top), edge, text: n.textContent.trim().slice(0, 24) };
              }
              return null;
            }, id);
            if (m && m.top < m.edge) low.push(`#${id} "${m.text}" at ${m.top}px, scrim ends ${m.edge}px`);
          }
          check(low.length === 0, `${tag}: every anchor's first line lands clear of the scrim (${ids.length} anchors)`);
          for (const l of low) console.log(`    ${l}`);
        }
        await ctx.close();
      }
    }
  }
  console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
  return failures ? 1 : 0;
});
