/**
 * Bakes the hero crystal in Blender and copies the results into public/models/.
 *
 * Usage:
 *   npm run bake:crystal           (uses the SEED constant in bake-crystal.py)
 *   npm run bake:crystal -- 2      (override the seed)
 *
 * Requires BLENDER_PATH in .env.local (see .env.example). The Blender project
 * lives outside the repo in <home>\OneDrive\Desktop\blender; override with
 * CRYSTAL_BAKE_DIR if yours is elsewhere.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();

function readEnvLocal() {
  const p = path.join(repoRoot, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnvLocal(), ...process.env };

const blender = env.BLENDER_PATH;
if (!blender || !existsSync(blender)) {
  console.error(
    "BLENDER_PATH is not set or does not exist.\n" +
    "Add it to .env.local, e.g.\n" +
    '  BLENDER_PATH="C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe"',
  );
  process.exit(1);
}

const bakeDir =
  env.CRYSTAL_BAKE_DIR || path.join(os.homedir(), "OneDrive", "Desktop", "blender");
const bakeScript = path.join(bakeDir, "bake-crystal.py");
if (!existsSync(bakeScript)) {
  console.error(`Bake script not found: ${bakeScript} (set CRYSTAL_BAKE_DIR?)`);
  process.exit(1);
}

const seed = process.argv[2];
const args = ["-b", "-P", bakeScript];
if (seed !== undefined) args.push("--", "--seed", String(seed));

console.log(`> "${blender}" ${args.join(" ")}`);
const run = spawnSync(blender, args, { stdio: "inherit" });
if (run.status !== 0) {
  console.error(`Blender exited with code ${run.status}`);
  process.exit(run.status ?? 1);
}

const outDir = path.join(repoRoot, "public", "models");
mkdirSync(outDir, { recursive: true });
for (const f of ["crystal.glb", "crystal_normal.png"]) {
  const src = path.join(bakeDir, f);
  if (!existsSync(src)) {
    console.error(`Expected bake output missing: ${src}`);
    process.exit(1);
  }
  copyFileSync(src, path.join(outDir, f));
  console.log(`copied ${f} -> public/models/`);
}
