/**
 * Draws one frame from engine state. Everything is drawn at logical
 * resolution into an offscreen canvas, then upscaled to the display
 * canvas with image smoothing off, so pixels stay hard at any size.
 */
import { WORLD_W, type GameState } from "./engine.ts";
import { PALETTE } from "./palette.ts";

export interface View {
  display: HTMLCanvasElement;
  dctx: CanvasRenderingContext2D;
  buf: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical size. */
  w: number;
  h: number;
  reducedMotion: boolean;
}

/** Desktop: 320x568 portrait. Phones: full-bleed, height from aspect. */
export function logicalSize(cssW: number, cssH: number, fullBleed: boolean): { w: number; h: number } {
  if (!fullBleed) return { w: WORLD_W, h: 568 };
  return { w: WORLD_W, h: Math.round(Math.max(480, Math.min(760, (WORLD_W * cssH) / cssW))) };
}

export function createView(display: HTMLCanvasElement, w: number, h: number, reducedMotion: boolean): View {
  const buf = document.createElement("canvas");
  buf.width = w;
  buf.height = h;
  const ctx = buf.getContext("2d")!;
  const dctx = display.getContext("2d")!;
  return { display, dctx, buf, ctx, w, h, reducedMotion };
}

/** Size the display backing store to its CSS box at device pixels. */
export function fitDisplay(v: View): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = v.display.getBoundingClientRect();
  const bw = Math.max(1, Math.round(r.width * dpr));
  const bh = Math.max(1, Math.round(r.height * dpr));
  if (v.display.width !== bw || v.display.height !== bh) {
    v.display.width = bw;
    v.display.height = bh;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── Sprites (built once) ──────────────────────────────────── */

function sprite(rows: string[], colors: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = rows[0].length;
  c.height = rows.length;
  const x = c.getContext("2d")!;
  rows.forEach((r, j) =>
    [...r].forEach((ch, i) => {
      const col = colors[ch];
      if (col) {
        x.fillStyle = col;
        x.fillRect(i, j, 1, 1);
      }
    }),
  );
  return c;
}

let _gem: HTMLCanvasElement | null = null;
function gemSprite(): HTMLCanvasElement {
  if (_gem) return _gem;
  _gem = sprite(
    ["...###...", "..#hhh#..", ".#hhhhh#.", "#hhooohh#", "#hoooooh#", ".#hoooh#.", "..#hoh#..", "...#h#...", "....#...."],
    { "#": PALETTE.gem, h: PALETTE.gemShade, o: PALETTE.gemCore },
  );
  return _gem;
}

/* ── Frame ─────────────────────────────────────────────────── */

export function renderFrame(v: View, s: GameState, alpha: number): void {
  const { ctx, w, h } = v;
  const camY = lerp(s.prev.camY, s.camY, alpha);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.bgTop);
  g.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const gx = lerp(s.prev.x, s.gem.x, alpha);
  const gy = lerp(s.prev.y, s.gem.y, alpha) - camY;
  const spr = gemSprite();
  ctx.drawImage(spr, Math.round(gx - spr.width / 2), Math.round(gy - spr.height / 2));

  blit(v);
}

function blit(v: View): void {
  const { dctx, display, buf } = v;
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(buf, 0, 0, display.width, display.height);
}
