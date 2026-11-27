#!/usr/bin/env node
// Browsers an automated run left open: Playwright's Firefox (-juggler-pipe),
// Playwright's Chromium/Edge (--remote-debugging-pipe) and Lighthouse's
// Chrome (a lighthouse.* profile). A browser you opened yourself carries none
// of these, so it is never listed or closed.
//
//   node scripts/strays.mjs           list them (exit 1 if any)
//   node scripts/strays.mjs --kill    close them, with their child processes
import { execFileSync } from "node:child_process";

const MARKERS = [/-juggler-pipe\b/, /--remote-debugging-pipe\b/, /--user-data-dir=\S*lighthouse\./i];
const BROWSERS = /^(firefox|chrome|msedge|chromium|chrome-headless-shell|headless_shell)(\.exe)?$/i;
const kill = process.argv.includes("--kill");

const list = () => {
  if (process.platform === "win32") {
    const ps = "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | Select-Object ProcessId, ParentProcessId, Name, CommandLine | ConvertTo-Json -Compress";
    const json = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8", maxBuffer: 64 << 20 });
    return [JSON.parse(json || "[]")].flat().map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, name: p.Name, cmd: p.CommandLine }));
  }
  return execFileSync("ps", ["-eo", "pid=,ppid=,comm=,args="], { encoding: "utf8" }).split("\n").filter(Boolean).map((l) => {
    const [pid, ppid, name, ...cmd] = l.trim().split(/\s+/);
    return { pid: Number(pid), ppid: Number(ppid), name: name.split("/").pop(), cmd: cmd.join(" ") };
  });
};

const procs = list();
const strays = procs.filter((p) => BROWSERS.test(p.name) && MARKERS.some((m) => m.test(p.cmd)));
// Only the browser roots: killing one takes its children with it
const roots = strays.filter((p) => !strays.some((q) => q.pid === p.ppid));

if (!roots.length) {
  console.log("no stray automation browsers");
  process.exit(0);
}
for (const p of roots) {
  console.log(`${kill ? "closing" : "stray"}  ${p.name} pid ${p.pid}  ${p.cmd.slice(0, 120)}`);
  if (!kill) continue;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(p.pid, "SIGKILL");
  } catch {
    console.log(`  could not close pid ${p.pid} (already gone?)`);
  }
}
process.exit(kill ? 0 : 1);
