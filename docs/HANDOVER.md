# Handover: 2026-11-27

## Where we are

**THE VOID is the default DREAM experience, on `master`.** Clicking DREAM
floods the page into the pixel-art game (three rooms, a seal mini-boss in
each, each seal frees one project). The 3D Archive is retired.

- `?dream=void` no longer does anything (it used to opt in to the game).
- `?dream=archive` opens the old 3D Archive. **This is a temporary escape
  hatch: delete it on or after 2026-12-03**, with everything in
  `src/components/archive/` except `ArchiveSlot.tsx`, plus the Archive-only
  scripts and test hooks. The dated comment is at the top of `ArchiveSlot.tsx`.

`master` and `dream-game` point at the same commit. The hero (the crystal
re-aim, the orbit ring) is unchanged since the last handover.

## Where the game lives

| File | What it is |
|---|---|
| `src/components/archive/ArchiveSlot.tsx` | The slot around DREAM: warm-up on the first interaction, the flood-tracked reveal, page suspension (scroll lock, inert, R3F paused, Lenis stopped), scroll restore on WAKE, waking at Contact. Holds the game (or the Archive with `?dream=archive`). |
| `src/components/void/VoidGame.tsx` | The shell: canvas, input, loop, HUD, end cards, unlocking freed projects. |
| `src/components/void/engine.ts` | The rules (rooms, enemies, seals, `TUNE`). No DOM; `engine.test.ts` covers them. |
| `src/components/void/render.ts`, `palette.ts` | Pixel drawing and colours. |
| `src/store/useArchiveProgress.ts` | Saved progress (`archive-progress-v1`). A freed seal calls `recover(slug, { openOnWake: false })`, which marks its Works card "Recovered from the dream". |

## What landed this session

| Commit | What |
|---|---|
| `1d11a7d` | A freed seal marks its Works card (the game wrote `freed`, the card reads `recovered`) |
| `c635285` | DREAM after a won run starts a new run (it showed a button-less card for good) |
| `992e6c0` | THE VOID is the default; the Archive goes behind `?dream=archive` |
| `405f56c` | Shared bot `scripts/shot/_voidbot.mjs`; Firefox end-to-end `scripts/verify/void-run.mjs` |

## Checks

- `npm run test:void`: 34/34 rules tests (no server needed).
- Browser checks against `next build && next start -p 3100` (stop any old
  :3100 server first, or it serves a replaced `.next` and the game never
  boots):
  - **`node scripts/verify/void-run.mjs --url=http://localhost:3100`**: Firefox,
    cold load, real preloader and mode pill, a full run. Takes about 6 min.
    Last result: all passed. Warm-up 0.7 s after the first interaction; reveal
    through a growing circle; page suspended (5/5 siblings inert, 0 page
    WebGL draws); scroll restored on WAKE; all three seals freed in 375 s
    with 14 deaths; woke at Contact; three Works cards marked, the fourth not.
  - `void-input.mjs`, `void-death.mjs`, `void-contrast.mjs`, `void-end.mjs`
    (Edge), each with `--url=http://localhost:3100`.
- Recordings: `node scripts/shot/void-record.mjs http://localhost:3100
  --room=N --wave=none --name=... [--trace] [--novideo]`. Videos land in
  `shots/void/` (git-ignored).
- Lighthouse, home: `node scripts/perf/lh-home.mjs <label> 5`. Only a
  back-to-back A/B means anything on this machine: the same build scored
  0.96 and 0.73 hours apart. Back to back, old master 0.73 (TBT 1444 ms) vs
  new 0.75 (TBT 1170 ms), 1338 KB both. The home page loads the same 21
  scripts as before; the game loads only on interaction, which Lighthouse
  never makes.

## Later on 2026-11-27

| Commit | What |
|---|---|
| `7d72650` | Every Playwright script launches through `scripts/_browser.mjs` (headless unless `--headed`, closes on exit); `scripts/strays.mjs` |
| `fa8aa18` | Seal checkpoint: once a room's wave is down, a death there restarts at the seal ("R · Back to the seal") |
| `e7dc100` | Broken shards stay below the fixed header (`headerBand.ts`; check `verify/shard-clamp.mjs`) |
| `fc9e5f0` | `glass-tone` (dL* <= 55) and `logo-contrast` (edge >= 12) match the chosen crystal; each file says why |
| `218f32d` | `.vercelignore` whitelist (verified: a staged copy builds the same 12 pages) |
| `08d81c0` | Seal 3 eased: rings 1.2 s apart, its own gap 1.15 rad. Three Firefox runs: 3 / 3 / 2 deaths (was 8 / 18 / 4) |

Decided by you: `openOnWake: false` stays (the Works card is marked, no
case study is forced open). `chore/next-16.4.6` was dropped (branch,
remote and worktree deleted): Next is upgraded deliberately, later.

## Deployment: deferred

**Deployment is deferred by your choice, not blocked by a problem.** You
chose to skip it for now and come back to it. For the record: the Vercel
CLI (67.0.0) is installed, but its login never completed on this machine
(`vercel whoami` prints "Logged out"; there is no `auth.json` under
`%APPDATA%com.vercel.cliData`). When you pick it up: `vercel login`,
`vercel whoami`, `vercel link --yes` (project `portfolioweb`),
`vercel deploy --prod`. Then production Lighthouse (home and one case
study, mobile and desktop), DREAM and the game on the live URL, and the
videos served from the CDN rather than inlined.

## Open items

- **The Archive's own test scripts don't pass `?dream=archive`**
  (`verify/archive`, `freeing`, `ending`, `archive-audio`, `shot/archive`,
  `perf/*`), so they can't reach it this week. Fix them or let them go with
  the Archive on 2026-12-03.
- `logo-contrast.mjs` in DREAM sometimes catches a frame before the logo is
  drawn (0 logo pixels: a load-timing flake, not a contrast reading).
- Your crystal note: its dark area reads as one solid mass on the right,
  where the reference has narrower streaks. Not yet addressed.

## Next steps

1. **Boons** (one after each room, named for the freed project): in progress.
2. **The feel-and-sound pass** (hit feel, sounds behind the Sound toggle).
3. **Delete the Archive** on or after 2026-12-03, if nothing turned up.
4. **The launch list:** mobile check, meta and social, then the deploy
   (deferred, see above).
