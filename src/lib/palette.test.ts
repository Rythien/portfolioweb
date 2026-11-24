import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE } from "./palette.ts";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(join(SRC, "app/globals.css"), "utf8");

/** A custom property's value inside the block that `selector` opens. */
function prop(selector: string, name: string): string | undefined {
  const at = css.indexOf(selector);
  if (at < 0) return undefined;
  const block = css.slice(at, css.indexOf("}", at));
  return block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
}

test("the scene palette mirrors globals.css", () => {
  const wake = ':root,\nhtml[data-mode="wake"]';
  const dream = 'html[data-mode="dream"] {\n  --t-surface';
  assert.equal(prop(wake, "--t-ink")?.toLowerCase(), PALETTE.wake.ink.toLowerCase());
  assert.equal(prop(wake, "--t-surface")?.toLowerCase(), PALETTE.wake.paper.toLowerCase());
  assert.equal(prop(dream, "--t-surface")?.toLowerCase(), PALETTE.dream.paper.toLowerCase());
});
