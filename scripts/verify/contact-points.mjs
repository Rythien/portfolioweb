#!/usr/bin/env node
/**
 * Email and phone stay out of what a scraper downloads, and still work.
 *
 *   node scripts/verify/contact-points.mjs [--url=http://localhost:3000]
 *
 * Run against `next build && next start` (dev chunks are not minified).
 *
 * 1. Raw HTML of / and /cv, plus every JS / CSS chunk they load, must not
 *    contain the address, its user or host, an "@gmail" pattern, "mailto:"
 *    with an address, or the phone digits in any common grouping.
 * 2. After hydration (Firefox): Send Email and "Get in touch" are mailto
 *    links to the address, the copy button writes the address to the
 *    clipboard (writeText is stubbed to record it), and the phone link
 *    dials the number. Same for the email link on /cv.
 *
 * The expected values are given here as char codes, so this script is
 * no easier to scrape than the site.
 */
import { firefox } from "playwright";
import { launch, session } from "../_browser.mjs";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = arg("url", "http://localhost:3000");
const dec = (codes) => String.fromCharCode(...codes);
const EMAIL = dec([115, 101, 114, 111, 110, 46, 109, 97, 104, 97, 114, 106, 97, 110, 46, 53, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109]);
const DIGITS = dec([57, 56, 50, 51, 51, 55, 50, 57, 48, 52]);
const [USER, HOST] = EMAIL.split("@");

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};

// 1. What a non-JS scraper downloads
const forbidden = [
  EMAIL,
  USER,
  `@${HOST}`,
  "mailto:" + USER,
  DIGITS,
  `${DIGITS.slice(0, 5)} ${DIGITS.slice(5)}`,
  `${DIGITS.slice(0, 3)} ${DIGITS.slice(3, 6)} ${DIGITS.slice(6)}`,
  `${DIGITS.slice(0, 4)}-${DIGITS.slice(4)}`,
];
for (const path of ["/", "/cv"]) {
  const html = await (await fetch(base + path)).text();
  const assets = [...new Set([...html.matchAll(/\/_next\/static\/[^"'\s\\]+\.(?:js|css)/g)].map((m) => m[0]))];
  const bodies = [["HTML", html]];
  for (const a of assets) bodies.push([a, await (await fetch(base + a)).text()]);
  const hits = [];
  for (const [name, body] of bodies) for (const f of forbidden) if (body.includes(f)) hits.push(`${name} has "${f.replace(/./g, (c, i) => (i < 3 ? c : "*"))}"`);
  check(hits.length === 0, `${path}: HTML + ${assets.length} chunks free of the email and phone${hits.length ? ": " + hits.join("; ") : ""}`);
}

// 2. Still works in the browser
await session(async () => {
  const browser = await launch(firefox);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    window.__copied = [];
    const stub = { writeText: (t) => (window.__copied.push(t), Promise.resolve()) };
    Object.defineProperty(navigator, "clipboard", { value: stub, configurable: true });
  });
  await page.goto(`${base}/?nopreload=1`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  const links = await page.evaluate(() => ({
    send: document.querySelector('#contact a[data-cursor="Email"]')?.getAttribute("href"),
    touch: document.querySelector('footer a[data-cursor="Email"]')?.getAttribute("href"),
    tel: document.querySelector('#contact a[href^="tel:"]')?.getAttribute("href"),
    telText: document.querySelector('#contact a[href^="tel:"]')?.textContent,
  }));
  check(links.send === `mailto:${EMAIL}`, "Send Email is a mailto link to the address");
  check(links.touch === `mailto:${EMAIL}`, '"Get in touch" is a mailto link to the address');
  check(links.tel === `tel:+977${DIGITS}`, "phone link dials the number");
  check(links.telText === `+977 ${DIGITS}`, "phone number is shown");
  await page.evaluate(() => document.getElementById("contact").scrollIntoView());
  await page.waitForTimeout(800);
  await page.click('#contact button:has-text("Copy")');
  await page.waitForTimeout(300);
  const copied = await page.evaluate(() => window.__copied);
  const label = await page.evaluate(() => document.querySelector('#contact button[aria-label]')?.textContent);
  check(copied.length === 1 && copied[0] === EMAIL, "copy button copies the address");
  check(/Copied/.test(label ?? ""), "copy button confirms");

  await page.goto(`${base}/cv`, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1000);
  const cv = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.href.startsWith("mailto:"))?.getAttribute("href"));
  check(cv === `mailto:${EMAIL}`, "/cv email link works");

  console.log(failures ? `\nFAIL: ${failures}` : "\nPASS");
  return failures ? 1 : 0;
});
