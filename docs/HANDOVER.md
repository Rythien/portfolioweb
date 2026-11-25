# Handover: 2026-11-26

## Where we are

Two streams of work, both on GitHub:

1. **The hero (done, on `master`).** The crystal was re-aimed from "clear" to
   "solid with structure": angular cuts, opaque brown-black and blue veins
   (about 29% of the glass below L* 30), hard blown speculars, matte worn
   faces at the bottom, a chromatic fringe where the clear side bends the
   headline, the logo as a solid mark, and a warm pool of light underneath. The orbit
   ring is a tight halo with fine engraved lettering. Measured by
   `scripts/verify/crystal-values.mjs`: both modes span L* ≤ 10 to 100.
2. **THE VOID (in progress, on `dream-game`).** The pixel-art game that
   replaces the 3D Archive in DREAM. It is behind `?dream=void`; the Archive
   is still the default. Steps 1–2 are done and seals are mostly done (see below).

## What's on `master`

Everything up to `492590f`: the hero work above, plus THE VOID step 1 (one
room, the gem, drifters, death card, input fix), hidden behind `?dream=void`.

## What's on `dream-game` (ahead of `master`)

| Piece | Commit | State |
|---|---|---|
| Charger (0.4 s tell, locked line, two hits) | `af1205e` | done |
| Spitter (keeps distance, 0.5 s tell, slow bolt) | `6645777` | done |
| Three rooms with doorways | `89b8d04` | done |
| Wave mix: room 1 8D; room 2 6D+3C; room 3 4D+2C+3S | `9585343` | done |
| Island bake perf (30 ms → 7 ms per room change) | `2a770e7` | done |
| Seal 1 (one ring, 3-bolt fan, 1.5 s window) | `20082f1` | done, recorded, ~12 s to free |
| Seal 2 (two crossing rings, 5-bolt fan, 1.3 s) | `7466d8f` | done, recorded, ~16 s to free |
| Seal 3 + the ending (wake at Contact) | `552263e` | **logic done and tested; not yet played through** |
| Recording bot rides ring gaps | `f0e0d8b` | **WIP, untested** |

The seal loop: **ring** (a danger ring warns at its base with the gap shown,
then a ring of shards spins outward), **fire** (it blinks danger, dotted
lines show a locked fan, then slow bolts), **window** (its core opens in pale
ice; one hit per window; three hits free it). Freeing it blooms the
project's DREAM cover and unlocks it through `useArchiveProgress.free`
(the store the awake page reads), then opens the door. Room 3's seal wins
the run and wakes the visitor at Contact.

Time to free each seal, from its rising (floor = a perfect hitter; bot = a
scripted competent player in Edge):

| Seal | Floor | Bot |
|---|---|---|
| 1 | 9.8 s | 11.9–12.4 s, no damage |
| 2 | 13.4 s | 15.7–15.8 s, 0–2 hearts lost |
| 3 | 15.9 s | not yet measured (the bot died twice) |

## Checks

- `npm run test:void`: 34/34 rules tests (no server needed).
- Browser checks against `next build && next start -p 3100` (kill any old
  :3100 server first, or it serves a replaced `.next` and the game never
  boots): `scripts/verify/void-input.mjs`, `void-death.mjs`,
  `void-contrast.mjs`, `void-end.mjs`, each with `--url=http://localhost:3100`.
- Recordings: `node scripts/shot/void-record.mjs http://localhost:3100
  --room=N --wave=none --name=sealN [--trace] [--novideo]`. Test hooks:
  `?voidroom=N`, `?voidwave=none|charger:4,…`. Videos land in `shots/void/`
  (git-ignored).
- In headless Edge, frame intervals stall around 40 ms on any full-window
  repaint (the browser's compositor, not the game). Judge the game by its own work per
  frame (`__void.work`; p95 ≈ 0.5 ms).

## Next step

1. **Seal 3:** run the WIP bot (`--room=3 --wave=none --trace`, several
   times). If it survives, record `shots/void/seal3.webm` and measure its
   time to free. If even a gap-riding player can't do it cleanly, retune
   seal 3 (rings 1.0 s apart are only 34 px apart: try 1.2 s or a wider gap).
2. **The WAKE-page shard clamp (not started):** broken shards drift up over
   the fixed header and sit on top of the nav. Cause: their drift targets
   (`GlassCrystal.tsx`, `driftCenter`, biased to the top band) ignore the
   header. Planned fix: each frame, convert the header's bottom edge to a
   world height at the shard's depth (portal camera, perspective) and clamp
   the drift target so the shard's top stays below it. Its own branch off
   `master`.
3. Then, as agreed: **boons**, then **feel and sound**.

## Open questions waiting on you

- **Seal 3 difficulty:** keep it hard (the run's finale) or ease it once the
  bot's numbers are in?
- **Merging `dream-game`:** merge after seal 3 is played through, or wait
  for boons? The game stays behind `?dream=void` either way.
- **When THE VOID replaces the Archive** as DREAM's default (and the 3D
  Archive code is retired).
- **`chore/next-16.4.6`** (the Next 16.4.6 upgrade, its own worktree at
  `../portfolioweb-next-16.4.6`) has never been merged into `master`. Merge it,
  or drop it?
- Two checks still fail by design since the crystal re-aim:
  `logo-contrast.mjs` (WAKE edge 9.8, needs 15) and `glass-tone.mjs` (WAKE
  halves 20 L* apart, needs ≤ 3). Lower their thresholds to match the new
  look, or retire them?
- Your note on the crystal: its dark area reads as one solid mass on the
  right, where the reference has narrower streaks. Not yet addressed.
