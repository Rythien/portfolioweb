#!/usr/bin/env node
/**
 * The WAKE/DREAM control never covers copy or a control.
 *
 *   node scripts/verify/pill-cover.mjs [--url=http://localhost:3000]
 *        [--widths=390,414,768] [--modes=wake,dream] [--steps=10]
 *
 * At each width and mode, the home page is scrolled to ten positions spread
 * evenly from the top to the bottom (both by jumping there and by scrolling
 * back up into it, since a hide-on-scroll control reappears on the way up).
 * At each position, every visible text line and every interactive element
 * (a, button, input, select, textarea, [tabindex], [role=button]) outside
 * the control is intersected with the control's box. Any overlap of 1px or
 * more fails.
 *
 * "Visible" means what a reader could see: the rect is clipped by every
 * ancestor that clips overflow, by the opaque header band (below lg the
 * header is solid, so copy under it is already hidden; header-band.mjs
 * guards that band), and skipped when an ancestor has opacity under 0.05,
 * visibility hidden, display none, inert or aria-hidden.
 */
import { firefox } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const widths = arg("widths", "390,414,768").split(",").map(Number);
const modes = arg("modes", "wake,dream").split(",");
const STEPS = Number(arg("steps", "10"));

const audit = () => {
  // The control is rendered twice (docked and floating); one is displayed
  const all = [...document.querySelectorAll('[aria-label="Site mode"]')];
  const control = all.find((e) => e.getClientRects().length > 0);
  if (!control) return { error: "no displayed [aria-label='Site mode'] control" };
  if (all.filter((e) => e.getClientRects().length > 0).length > 1) return { error: "both mode controls are displayed" };
  const cs = getComputedStyle(control);
  const c = control.getBoundingClientRect();
  // A control that is hidden (scrolled away, faded) covers nothing
  let hidden = cs.visibility === "hidden" || c.width === 0;
  for (let e = control; e && !hidden; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (Number(s.opacity) < 0.05 || s.visibility === "hidden") hidden = true;
  }
  const onScreen = c.bottom > 0 && c.top < innerHeight;
  const ctl = { top: c.top, bottom: c.bottom, left: c.left, right: c.right, hidden: hidden || !onScreen };
  if (ctl.hidden) return { ctl, hits: [] };

  const header = document.querySelector("header");
  const inHeader = header?.contains(control);
  const hb = header?.getBoundingClientRect();
  const headerBand =
    header && innerWidth < 1024 ? { top: 0, bottom: Math.min(hb.bottom, 80) } : null;

  const invisible = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (e === control) return true;
      if (e.inert || e.getAttribute?.("aria-hidden") === "true") return true;
      const s = getComputedStyle(e);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return true;
    }
    return false;
  };
  const clip = (el, r) => {
    let { top, bottom, left, right } = r;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/(hidden|clip|auto|scroll)/.test(s.overflow + s.overflowX + s.overflowY)) {
        const p = e.getBoundingClientRect();
        top = Math.max(top, p.top); bottom = Math.min(bottom, p.bottom);
        left = Math.max(left, p.left); right = Math.min(right, p.right);
      }
    }
    // Copy outside the header that runs under the solid header band is
    // already hidden by it
    if (headerBand && !header.contains(el) && top < headerBand.bottom) top = Math.max(top, headerBand.bottom);
    return { top, bottom, left, right };
  };
  const overlap = (r) => {
    const w = Math.min(r.right, ctl.right) - Math.max(r.left, ctl.left);
    const h = Math.min(r.bottom, ctl.bottom) - Math.max(r.top, ctl.top);
    return w >= 1 && h >= 1 ? Math.round(w * h) : 0;
  };
  const name = (el) => {
    const id = el.closest("[id]")?.id;
    return `${el.tagName.toLowerCase()}${id ? ` in #${id}` : ""}`;
  };
  const hits = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent.trim();
    if (!t || !n.parentElement || invisible(n.parentElement)) continue;
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(n.parentElement.tagName)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 1) continue;
      const a = overlap(clip(n.parentElement, r));
      if (a) { hits.push(`text "${t.slice(0, 40)}" (${name(n.parentElement)}, ${a}px²)`); break; }
    }
  }
  const sel = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [role=button]";
  for (const el of document.querySelectorAll(sel)) {
    if (control.contains(el) || invisible(el)) continue;
    const a = overlap(clip(el, el.getBoundingClientRect()));
    if (a) hits.push(`control ${name(el)} "${(el.getAttribute("aria-label") || el.textContent).trim().slice(0, 30)}" (${a}px²)`);
  }
  return { ctl, hits, inHeader };
};

const browser = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
let failures = 0;
for (const mode of modes) {
  for (const w of widths) {
    const h = w < 768 ? (w === 414 ? 896 : 844) : 1024;
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const q = `nopreload=1&mode=${mode}${mode === "dream" ? "&noarchive=1" : ""}`;
    await page.goto(`${base}/?${q}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(2500);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const positions = Array.from({ length: STEPS }, (_, i) => Math.round((max * i) / (STEPS - 1)));
    const bad = [];
    let shown = 0;
    // Down the page, then back up through the same positions
    for (const [dir, list] of [["down", positions], ["up", [...positions].reverse()]]) {
      for (const y of list) {
        // Arrive by a real wheel gesture over the last 400px, so scroll
        // direction logic sees the direction the reader moved in
        const from = dir === "down" ? Math.max(0, y - 400) : Math.min(max, y + 400);
        await page.evaluate((y) => window.scrollTo(0, y), from);
        await page.waitForTimeout(150);
        await page.mouse.move(w / 2, h / 2);
        await page.mouse.wheel(0, y - from);
        await page.waitForTimeout(700);
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(500);
        const r = await page.evaluate(audit);
        if (r.error) { bad.push(r.error); break; }
        if (!r.ctl.hidden) shown++;
        for (const hit of r.hits) bad.push(`${dir} y=${y}: covers ${hit}`);
      }
    }
    const uniq = [...new Set(bad)];
    if (!shown) uniq.push("the control was never visible (it must be reachable)");
    if (uniq.length) {
      for (const b of uniq.slice(0, 12)) console.log(`✗ ${mode} ${w}px ${b}`);
      if (uniq.length > 12) console.log(`  … ${uniq.length - 12} more`);
    } else console.log(`✓ ${mode} ${w}px: nothing covered at ${STEPS * 2} stops (control visible at ${shown})`);
    failures += uniq.length;
    await page.close();
  }
}
await browser.close();
console.log(failures ? `\nFAIL: ${failures} problem(s)` : "\nPASS");
process.exit(failures ? 1 : 0);
