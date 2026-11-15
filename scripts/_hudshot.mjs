import { firefox } from "playwright";
const b = await firefox.launch({ headless: true, firefoxUserPrefs: { "webgl.force-enabled": true } });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3000/?nopreload=1&mode=dream&noarchive=1", { waitUntil: "domcontentloaded" });
await p.evaluate(() => localStorage.setItem("archive-progress-v1", JSON.stringify({ freed: ["pixel-plus"], recovered: [], hintSeen: false })));
await p.goto("http://localhost:3000/?nopreload=1&mode=dream&archivecharge=3", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(9000);
await p.screenshot({ path: "shots/hud-charged.png" });
await b.close();
