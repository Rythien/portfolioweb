#!/usr/bin/env node
// Per-frame work in the Archive, independent of machine load: draw calls
// and triangles summed over every pass of one frame (seal backdrop
// included) and compiled shader programs, via the __archiveInfo hook.
// Usage: [BASE=...] node scripts/perf-archive-frame.mjs [label]
import { firefox } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
for (const [name, q] of [["spawn", ""], ["seal0", "&archiveat=0"]]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.goto(`${BASE}/?nopreload=1&mode=dream&noarchive=1`, { waitUntil: "domcontentloaded" });
  await p.evaluate(() => localStorage.removeItem("archive-progress-v1"));
  await p.goto(`${BASE}/?nopreload=1&mode=dream${q}`, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => (window.__archiveFrames ?? 0) > 30, null, { timeout: 90000 });
  await p.waitForTimeout(3000);
  console.log(process.argv[2] ?? "", name, JSON.stringify(await p.evaluate(() => window.__archiveInfo())));
  await p.close();
}
await b.close();
