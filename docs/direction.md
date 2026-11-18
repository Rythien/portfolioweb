# Direction: GLACIER / AFTERGLOW

**One line:** an editorial, near-monochrome portfolio page with one real object on it (the crystal), and
a DREAM state where the same page turns to glass and night.

Design read: solo web and interactive designer's portfolio for design-literate hiring managers and
clients. Minimalist editorial language (taste-skill + minimalist are the primary direction), leaning on
Geist + Geist Mono, native CSS tokens, GSAP for scroll and mode change, R3F for the one object.

Dials: variance 7 · motion 6 · density 3.

Sources and precedence, highest first: WCAG 2.2 and browser behaviour > this file > taste-skill >
minimalist > typography skills > ui-ux-pro-max reference data. When this file and a skill disagree,
this file wins and says why (see "Resolved conflicts").

---

## 1. Faces and type scale

Three families, three jobs. Nothing else renders text: not in the DOM, not in WebGL.

| Family | Job | Weights allowed |
|---|---|---|
| Geist (`--font-sans`) | every statement, heading, body line and button | 400, 600, 700, 800 |
| Geist Mono (`--font-mono`) | labels and numerals only | 500, 600 |
| Newsreader italic (`--font-display`) | the single accent word in a statement | 400 |

WebGL text (the hero marquee) uses a Geist subset at 800, not another face.

### Tokens

All sizes are `@utility` tokens in `src/app/globals.css`. Components use the token, never a Tailwind
size (`text-xs` … `text-9xl`) or an arbitrary `text-[…]`. The only exemptions are WebGL text sizes and
the ASCII globe glyph grid (art, `aria-hidden`).

| Token | Family | Size (fluid) | px at 375 → 1440+ | Weight | Tracking | Leading | Use |
|---|---|---|---|---|---|---|---|
| `text-display` | Geist, CAPS | `clamp(4rem, 2.5rem + 9vw, 11rem)` | 64 → 176 | 800 | -0.04em | 0.92 | at most **one** per page |
| `text-h1` | Geist, CAPS | `clamp(2.75rem, 1.9rem + 4.8vw, 6.5rem)` | 44 → 104 | 800 | -0.04em | 0.92 | page title, project titles |
| `text-h2` | Geist, CAPS | `clamp(2rem, 1.5rem + 2.5vw, 3.5rem)` | 32 → 56 | 700 | -0.03em | 0.95 | section statements |
| `text-h3` | Geist | `clamp(1.25rem, 1.1rem + 0.6vw, 1.625rem)` | 20 → 26 | 600 | -0.015em | 1.25 | sub-heads, list titles |
| `text-body-lg` | Geist | `clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem)` | 20 → 24 | 400 | -0.005em | 1.5 | lead paragraph, one per section |
| `text-body` | Geist | `clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)` | 17 → 19 | 400 | 0 | 1.6 | all running copy |
| `text-small` | Geist | `clamp(0.9375rem, 0.9rem + 0.15vw, 1.0625rem)` | 15 → 17 | 400 | 0.01em | 1.5 | captions, secondary lines |
| `text-label` | Geist Mono, CAPS | `clamp(0.875rem, 0.85rem + 0.15vw, 0.9375rem)` | 14 → 15 | 500 | 0.08em | 1.4 | labels, nav, buttons, meta |
| `tnum` | Geist Mono | inherits | n/a | 500 | 0 | 1 | numerals (years, counts, time) |
| `.accent-word` | Newsreader italic, lowercase | inherits | n/a | 400 | -0.01em | 1.1 + 0.05em bottom reserve | one word per statement |

Ratio: body 17 → h3 20 → h2 32 → h1 44 → display 64 on phones; each step at least 1.17×, display
to body above 9× on desktop. Hierarchy comes from weight and case as much as size.

DREAM changes tracking on CAPS tokens only: `+0.02em × --dream`. It does not change size, weight or
leading, so nothing reflows during the flood.

### Type rules

1. A statement is CAPS Geist with **exactly one** Newsreader accent word, chosen as the sentence's
   pivot. No accent word outside statements (not in titles of list rows, cards or subpage headings).
2. Newsreader never sets a whole heading, a name or a list item. Subpages use the same Geist tokens
   as the home page.
3. Mono is for labels and numerals. Never a sentence, never body copy, never a value longer than a
   short phrase.
4. Labels: `text-label` only. No size override, no tracking override (`tracking-widest`,
   `tracking-[…]`), weight 500 minimum, colour `ink/80` minimum.
5. No synthetic styles. Geist ships no italic here, so no `italic` on Geist text. Devanagari is
   never italicised and is set in a face that has the glyphs.
6. Every page has exactly one DOM `<h1>`, and heading levels descend without gaps. A heading that only
   exists in WebGL also exists in the DOM (visually hidden if needed).
7. Copy: no em-dashes or en-dashes anywhere a person can read it (page, `<title>`, OG, alt text). At
   most one `·` per line. Plain verbs; no "crafting", "elevate", "seamless", "breathe with life".
   Numbers are real or absent.

## 2. Spacing scale

8pt, plus one micro step for inline gaps.

| Token | px | Tailwind | Where it is allowed |
|---|---|---|---|
| `space-micro` | 4 | `1` | icon to text, inline glyph gaps only |
| `space-1` | 8 | `2` | inside a control |
| `space-2` | 16 | `4` | within a block |
| `space-3` | 24 | `6` | page gutter (phone), grid gutter |
| `space-4` | 32 | `8` | between sibling blocks |
| `space-5` | 40 | `10` | page gutter (tablet) |
| `space-6` | 48 | `12` | between sibling groups |
| `space-7` | 64 | `16` | header zone to content; page gutter (desktop); section padding (phone) |
| `space-8` | 96 | `24` | section padding (tablet) |
| `space-9` | 128 | `32` | section padding (desktop) |
| `space-10` | 192 | `48` | the one deliberate pause per page |

Off-scale values (12, 20, 28, 36, 56, 80, 112, 144) are violations. Component heights (header 80,
pill 44, touch targets ≥ 44) are sizes, not spacing, and are exempt.

Layout: 12-column grid, max width 80rem, column gutter 24. Body copy max 60ch, `text-wrap: pretty`;
headings `text-wrap: balance`. Section padding 64 / 96 / 128 at < 640 / ≥ 640 / ≥ 1024, plus
`--pill-clear` at the bottom. Full-height blocks use `min-h-[100dvh]`, never `h-screen`.

## 3. Colour tokens

Near-monochrome. Each mode has one surface family, one ink family and at most one accent. Components
reference tokens only; a hex or `rgba()` in a component (outside WebGL shaders) is a violation.

| Token | WAKE | DREAM | Role | Contrast on surface |
|---|---|---|---|---|
| `--t-surface` | `#E9E7E2` | `#07062B` | page | n/a |
| `--t-surface-el` | `#DFDCD6` | `#0F0E3A` | mats, raised fills | n/a |
| `--t-ink` | `#1A1A1E` | `#F2EFE9` | text, solid controls | 14.04 / 17.10 |
| `--t-ink-muted` | `#5F5F6C` | `#8B8E99` | secondary text | 5.09 / 6.01 (4.59 / 5.62 on `-el`) |
| `--t-ink-faint` | `#A0A0A8` | `#5A5D6B` | **never text**; disabled glyphs, decorative separators | 2.10 / 3.00 |
| `--t-rule` | ink @ 10% | ink @ 8% | 1px rules | n/a |
| `--t-rule-hover` | ink @ 25% | ink @ 20% | rule on hover / focus within | n/a |
| `--t-grid` | ink @ 6% | ink @ 6%, × (1 − `--dream`) | grid overlay | n/a |
| `--t-accent` | `= --t-ink` (WAKE is monochrome) | `#A894FF` | the only non-neutral colour | — / 7.80 |
| `--t-shadow` | `rgba(26,26,30,·)` ≤ 0.06 | `rgba(0,0,0,·)` ≤ 0.3 | shadow tint | n/a |
| `--t-glass-edge` | n/a | `rgba(255,255,255,0.12)` | glass inner highlight | n/a |

Text opacity steps on `--t-ink`: 100, 90, 80, 70. Body copy at 70 (5.78 WAKE / 8.46 DREAM). Anything
under 70 is decoration and must be `aria-hidden` or non-text.

The single DREAM violet (`#A894FF`) is every violet in the DOM: glass glow, cursor ring, focus accents.
The WebGL scene may grade freely, but DOM colour comes from this table. Other surfaces (OG image,
`/journey`) use WAKE or DREAM tokens, not a third palette.

## 4. Motion

Source of truth: `src/lib/motion.ts`. CSS mirrors it as `--ease-*`, `--dur-*` and `--loop-*` in
`globals.css`. `src/lib/motion.test.ts` fails if the mirrors drift **or if any file hard-codes a
duration, delay, stagger, scrub or ease**. No bounce or elastic. Two documented exceptions: the
Archive's game feedback (`ease.backOut`) and the crystal's 3% spring settle.

Scales: eases `entrance` (expo.out), `state` (power2.inOut), `scroll`
(cubic-bezier(0.16, 1, 0.3, 1)), `linear`. Durations `quick` 0.4 / `standard` 0.8 / `grand` 1.2.
Staggers `tight` 0.04 / `standard` 0.08, and a group's total stays under 0.5 s. Input feedback has its
own tier: `pointer` 0.08 / `press` 0.12 / `response` 0.24.

| Motion | Ease | Duration | Implementation |
|---|---|---|---|
| Lines, rows | entrance | standard, stagger tight | `revealLines`: rise 24px + fade, `TRIGGER` (`clamp(top 75%)`, plays once, `fastScrollEnd`; finished reveals are final) |
| Blocks, panels | entrance | standard, stagger standard | `revealBlock`: rise 40px + fade |
| Images | entrance | grand | `maskImage`: clip-path wipe top to bottom, on the art (never on a parent with overhangs) |
| Numbers | entrance (state for the intro) | standard / grand | `counterTo`: writes the DOM, no React state per frame |
| Mode change | state | flood grand (1.2 s), colour turn grand / 2 | every DREAM-reactive property keys off `--dream`; `data-mode` flips at 0.5 |
| Hover colour | entrance | response | Tailwind's bare `transition-*` default is set to this |
| Hover transform | entrance | quick | tilt ≤ 6°, chip scale |
| Press | entrance | press | `scale(0.97)` via `.pressable` |
| Magnetic | entrance | quick | `magnetTo`: 0.32 × offset, clamped to **8px**; release on the same curve |
| Scroll-linked progress | scroll | n/a | the crystal's hero-to-parked path |
| Scroll-scrubbed | linear | scrub lag quick | parallax ≤ 3% of element height; progress line |

Ambient loops are a closed list: the hero marquee (the page's **one** marquee), crystal idle, DREAM
fog and dust, the sound-wave bars while sound is on. Anything else that loops forever is cut.

Implementation: no `window.addEventListener("scroll")` (use ScrollTrigger or IntersectionObserver);
no `requestAnimationFrame` loop that sets React state; cleanups in every effect.

`prefers-reduced-motion`: the factories turn every entrance into a quick fade, the flood becomes a colour crossfade, loops stop,
magnetic and tilt are off, the custom cursor is off.

Every animation answers "what does this communicate" in one sentence (hierarchy, sequence, feedback,
or state change), or it is cut.

### Scroll moments

One loop: Lenis runs on `gsap.ticker`, ScrollTrigger reads it through a `scrollerProxy`, and scroll
velocity is measured on the same tick (`src/lib/scroll.ts`). Every moment uses `useGSAP` and resolves
to a fade under reduced motion. When a route leaves, every trigger whose element left with it is
killed (`src/app/template.tsx`).

| # | Moment | Where |
|---|---|---|
| 1 | Hero lines (meta row, WebGL marquee, disciplines, footer row) wipe up from their masks, 0.08 s apart, after the preloader; the marquee scrolls while hidden | `Hero.tsx`, `Marquee.tsx` |
| 2 | Big statements reveal word by word on masks at 75% | `MaskWords.tsx` (About, Contact) |
| 3 | Discipline rows wipe out of the list's left rule, numbers count up; hovering a row drops the others to 40% | `Disciplines.tsx`, `globals.css` |
| 4 | Works pins at lg+ and pans the three slides sideways, each scaling 0.94 to 1 as it centres; chips turn with scroll velocity | `Works.tsx`, `WorkChip.tsx` |
| 5 | `[data-skew]` section content leans with velocity, ≤ 1.5°, easing back to 0 | `ScrollSkew.tsx` |
| 6 | Recognition rows rise on 0.04 s with hairlines drawing left to right | `Recognition.tsx` |
| 7 | "GET IN touch" scales from 0.92; the italic word follows 0.15 s later | `Footer.tsx` |
| 8 | Footer ticker speeds up with velocity (×1 to ×4), never stops | `Footer.tsx` |

### Chrome

- **Hover:** every hover has a leave at 60% of its enter (`HOVER`: 0.4 s in, 0.24 s out). Bare
  Tailwind transitions rest on the leave timing and take the enter timing while hovered.
- **Buttons and links:** the label is two stacked copies that swap through a clip on hover and
  keyboard focus (`Swap.tsx`, `.swap`). There is no colour fade on hover.
- **Magnets:** only the mode pill, the header nav and the copy-email button. A pull starts 80 px
  from the edge, is capped at 8 px, and springs back (`EASE.spring`, the one overshoot outside the
  Archive).
- **Cursor** (fine pointer, motion allowed): a dot by default; a ring with a label that rises in
  for BREAK (crystal) and ENTER (brush blob, only where a click enters). Project panels carry no
  label; they read as clickable on their own.
- **Copy:** the label morphs to "Copied" with a drawn check, holds 1.6 s, then runs back at 60%.
- **Focus:** keyboard only, never removed: a 2px ring, 4px offset, ink in WAKE and `#a894ff` in
  DREAM.

Exceptions to the rules above, made for these moments: the Disciplines list carries a vertical
1px rule (§6 otherwise keeps rules horizontal); in the pinned Works layout project titles step down
to `text-h2` so they fit the slide's 4-column head; the footer ticker remains a second marquee
(§9), now velocity-driven.

## 5. WAKE and DREAM, per surface

| Surface | WAKE | DREAM |
|---|---|---|
| Grid overlay | visible hairlines | opacity 1 − `--dream` |
| Air | none | dust + slow fog (WebGL) |
| Statements | sharp, -0.04em | sharp, tracking opens +0.02em; **no glow on DOM text** |
| Panels | flat paper mat, 1px rule | frosted glass (see §7) |
| Cursor | dot + label ring, ink | ring tinted `--t-accent` |
| Crystal | ice | violet |
| Copy | factual | the same facts, a different register where authored; same face and style |

## 6. What brutalist may touch

Only these three things, and only as listed:

- **Mono labels.** `text-label`, uppercase, 0.08em. Short nouns ("Location", "2025", "Web design").
  At most one label above a heading per three sections (hero counts as one).
- **Rules.** 1px, `--t-rule`, horizontal, at block boundaries. One rule between groups, not a rule
  under every row. No borders thicker than 1px, no boxed grids.
- **Numerals.** Mono `tnum` for years, real counts and time. One live clock on the page (the rail;
  the header shows it below `lg`).

Not allowed from brutalist: section numbering (`(01)`, `01 / 03`, `02 / 07`, `Fig. 01`, `// 01`),
step labels (`01 / Listen`), bracketed controls (`[Menu]`), coordinate or locale strips, mono body
copy, raw thick borders, visible-grid decoration beyond the grid overlay, scoreboard counters.

## 7. What soft-design may touch

Only shadow, depth and glass:

- **Shadow.** Tinted with `--t-shadow`, WAKE opacity ≤ 0.06, never pure black on paper. DREAM may add
  one `--t-accent` glow on glass surfaces only, opacity ≤ 0.14. No shadow or glow on text.
- **Depth.** Perspective tilt (≤ 6°), the chip layered over its panel, the WebGL scene.
- **Glass.** `backdrop-filter` blur with a 1px inner edge and a top highlight, keyed to `--dream`.
  WAKE has glass only on the work chip (a physical object over imagery) and functional chrome blur
  (mode pill, header scrim). Every glass rule has a solid fallback under
  `@media (prefers-reduced-transparency: reduce)`.

Not allowed from soft-design: radius beyond the shape lock, gradient fills on surfaces, double-bezel
cards, pill CTAs, spring or bounce easing, pastel or warm-luxury palettes.

## 8. Shape lock

Radius 0 for every rectangle: panels, cards, buttons, inputs, figures, tags. `9999px` is reserved for
true circles and the mode pill: the pill and its segments, the work chip, cursor parts, round icon
buttons in the Archive. Nothing in between.

## 9. Page rules

- One layout family per section on the home page.
- One CTA label per intent. Contact intent has one label everywhere.
- One display statement per page.
- One marquee per page.
- No scroll cue, no decorative status dots, no hero-bottom keyword strip.
- Cards only where elevation means something; otherwise space and one rule.
- Every page is checked in both modes, at 375 / 768 / 1440, before it ships.

## Resolved conflicts

- **Serif accent word.** taste-skill calls mixed-family emphasis amateur; minimalist names Newsreader
  as its editorial serif. The accent word stays, because it is the brand's one serif move and is
  rule-bound (one word, statements only). Everywhere else the serif is a violation.
- **Custom cursor.** taste-skill bans custom cursors. Kept because it carries mode state (WAKE dot,
  DREAM ring) and labels hit targets; it is off for coarse pointers and reduced motion, and native
  cursors stay on inputs and in the Archive.
- **Local time.** taste-skill bans locale strips. One clock is kept because the brief is remote work
  across timezones. Coordinates and repeated clocks are not.
- **Heading glow in DREAM.** The previous direction asked for a halo on headings. soft-design's
  allowance is shadow, depth and glass, and taste-skill bans outer glows, so DREAM's glow moves into
  the WebGL scene and onto glass edges. DOM type stays sharp.
- **WAKE paper `#E9E7E2`.** Near taste-skill's banned "warm paper" family, but that ban targets
  premium-consumer briefs. Kept: it is the existing brand surface and reads neutral against cool ink.

Kept from the previous direction: the crystal and all R3F work, the ink flood, Lenis, the section
order and anchor slugs. The previous critique list is in git history (`git log -- docs/direction.md`).
