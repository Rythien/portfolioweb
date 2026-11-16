#!/usr/bin/env node
// Lighthouse (mobile, simulated throttling) on the home page, N runs,
// median reported. Needs a production server: next build && next start -p 3100
//   node scripts/perf/lh-home.mjs <label> [runs=3] [url=http://localhost:3100/]
// Writes shots/lh-<label>-<i>.json. Uses Edge (no Chrome on this machine).
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const shots = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "shots");
const [label = "run", runsArg = "3", url = "http://localhost:3100/"] = process.argv.slice(2);
const runs = Number(runsArg);
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" };
const rows = [];
for (let i = 1; i <= runs; i++) {
  const out = resolve(shots, `lh-${label}-${i}.json`);
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--no-install", "lighthouse", url, "--only-categories=performance", "--output=json", `--output-path=${out}`, "--quiet", "--chrome-flags=--headless=new"],
    { env, stdio: "inherit", shell: process.platform === "win32" },
  );
  const r = JSON.parse(readFileSync(out, "utf8"));
  const a = (k) => r.audits[k].numericValue;
  const bin = r.audits["network-requests"].details.items.find((x) => x.url.includes("crystal-chunk.bin"));
  rows.push({
    perf: r.categories.performance.score,
    fcp: a("first-contentful-paint"),
    lcp: a("largest-contentful-paint"),
    tbt: a("total-blocking-time"),
    si: a("speed-index"),
    bytes: a("total-byte-weight"),
    binStart: bin ? bin.networkRequestTime ?? bin.startTime : null,
  });
  const x = rows.at(-1);
  console.log(`run ${i}: perf ${x.perf}  FCP ${x.fcp.toFixed(0)}  LCP ${x.lcp.toFixed(0)}  TBT ${x.tbt.toFixed(0)}  SI ${x.si.toFixed(0)}  bytes ${(x.bytes / 1024).toFixed(0)} KB  crystal-chunk.bin ${bin ? "requested at " + x.binStart?.toFixed(0) + " ms" : "not requested"}`);
}
const med = (k) => rows.map((r) => r[k]).sort((p, q) => p - q)[Math.floor(rows.length / 2)];
console.log(`MEDIAN ${label}: perf ${med("perf")}  FCP ${med("fcp").toFixed(0)}  LCP ${med("lcp").toFixed(0)}  TBT ${med("tbt").toFixed(0)}  SI ${med("si").toFixed(0)}  bytes ${(med("bytes") / 1024).toFixed(0)} KB`);
