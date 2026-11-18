#!/usr/bin/env node
/**
 * No reveal is ever left mid-way.
 *
 *   node scripts/verify/reveals.mjs [--url=http://localhost:3000] [--modes=wake,dream] [--widths=1440,390]
 *
 * Every element a reveal animates carries [data-reveal] (the motion
 * factories tag their targets; the hero lines and the footer statement are
 * tagged in markup). The page is wheeled fast from top to bottom and back,
 * then every [data-reveal] element must be fully visible: opacity 1,
 * visibility visible, no transform (identity matrix counts as none) and no
 * clip. Runs once with the preloader and once without.
 */
import { firefox } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const modes = arg("modes", "wake,dream").split(",");
const widths = arg("widths", "1440,390").split(",").map(Number);

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
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
      const moved = m && !(m.isIdentity || (Math.abs(m.a - 1) < 1e-3 && Math.abs(m.d - 1) < 1e-3 && Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3 && Math.abs(m.e) < 0.5 && Math.abs(m.f) < 0.5));
      const clipped = cs.clipPath !== "none" && !/^inset\(0(%|px)?\)$/.test(cs.clipPath.replace(/\s+/g, " ").replace(/inset\(0(%|px)? 0(%|px)? 0(%|px)? 0(%|px)?\)/, "inset(0)"));
      if (parseFloat(cs.opacity) < 0.999 || cs.visibility !== "visible" || moved || clipped) {
        const label = (el.textContent || el.className || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
        bad.push(`${label} [opacity ${cs.opacity}, ${cs.visibility}, transform ${cs.transform.slice(0, 40)}, clip ${cs.clipPath}]`);
      }
    }
    return { count: els.length, bad };
  });

const wheel = async (page, dir) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const steps = Math.ceil(h / 600) + 4;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dir * 600);
    await page.waitForTimeout(25);
  }
};

for (const width of widths) {
  for (const mode of modes) {
    for (const preload of [false, true]) {
      const height = width < 768 ? 844 : 900;
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      const q = `mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}${preload ? "" : "&nopreload=1"}`;
      await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(preload ? 5000 : 2500);
      await page.mouse.move(width / 2, height / 2);
      await wheel(page, 1);
      await page.waitForTimeout(400);
      await wheel(page, -1);
      // Let anything still entering finish its own duration
      await page.waitForTimeout(1500);
      const r = await audit(page);
      const tag = `${width} ${mode} ${preload ? "with preloader" : "no preloader"}`;
      check(r.count > 0 && r.bad.length === 0, `${tag}: ${r.count} reveals, ${r.bad.length} not finished`);
      for (const b of r.bad.slice(0, 8)) console.log(`    ${b}`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
process.exit(failures ? 1 : 0);
