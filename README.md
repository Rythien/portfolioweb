# Searon Maharjan — Creative Developer Portfolio

> Personal portfolio for **Searon Maharjan**, Creative Developer & Frontend Architect based in Kathmandu, Nepal (`27.7172° N · 85.3240° E`).
> Inspired by the dark, technical, editorial precision and WebGL-rich atmosphere of *christendijoux.com*, synthesized with authentic Newari architectural craft and sacred geometry from the Kathmandu Valley.

---

## ✦ System Architecture & Design Direction

- **Palette**: Near-black void ground (`#050505`), off-white milk text (`#F5F5F3`, 17.5:1 contrast), and a single sharp accent color: **Nepalese Vermilion / *Rato Sindoor*** (`#FF3B26`), rooted in Patan Durbar Square terracotta and sacred Newari ritual pigment.
- **Typography**:
  - Display: **Syne** (monumental, architectural, wide-stance display typeface)
  - Body: **Geist Sans** (objective, humanist legibility)
  - Metadata & Coordinates: **JetBrains Mono** (technical stamps, live UTC+5:45 time, and metrics)
- **Motion & Graphics**:
  - **Lenis v1.1**: Inertial smooth scroll engine linked directly to GSAP ticker.
  - **GSAP 3.12 + ScrollTrigger**: Kinetic scrubbed timelines, horizontal project scroll on desktop, split-text line ascents.
  - **Hardware-Accelerated WebGL 2.0 & Canvas API**: Custom GLSL fragment shaders (Snell refraction, curl-noise particles, spring glyph physics) without heavy 3D library bloat.
  - **Custom Cursor**: Velocity-morphing magnetic cursor, disabled on touch devices (`@media (pointer: coarse)`).
- **Easter Egg**: Integrated "Negative Matrix Mode" toggle (`MODE: VOID` ↔ `MODE: INVERTED`) in the navigation bar and R&D Lab.

---

## ✦ Sections Included (In Order)

1. **Preloader**: Mechanical `000 → 100` percentage counter with vertical curtain split reveal.
2. **Hero**: Monumental two-line display name, role line, spatial coordinates, live Kathmandu local time (`UTC+5:45`), and reactive canvas particle field with CSS fallback.
3. **About**: Architectural manifesto, Newari craftsmanship connection, and three numbered focus areas (`#01`, `#02`, `#03`).
4. **Journey**: "From → Now" trajectory connecting historic Patan origins with global distributed engineering via vector line.
5. **Skills**: Categorized competence matrix with explicit counts (`Frontend · 08`, `Creative · 06`, `Motion · 06`, `Backend · 05`) and an expertise ticker with slash separators.
6. **Path (Experience)**: Vertical chronological timeline with expandable ARIA-compliant accordion rows, 3 bullet results each, and academic research highlights.
7. **Impact & Results**: High-impact metrics (`120 FPS target`, `98+ Lighthouse`, `14+ Awwwards/FWA`, `0.08s input latency`).
8. **Selected Projects**: Desktop horizontal scroll pinned with GSAP ScrollTrigger ("Scroll →"), converting to vertical stack on mobile; interactive case study drawer with architecture details.
9. **Lab**: 3 interactive real-time experiments (GLSL ripple shader, curl-noise particles, spring glyph physics) + Easter egg toggle.
10. **Colophon**: "The site, taken apart", detailing frameworks, typography, shaders, and ethical/accessibility standards.
11. **Contact**: "Let's work together" editorial CTA, magnetic email button with clipboard copy, verified social profiles, and resume link.
12. **Footer**: Initials monogram `SM`, live temporal clock, coordinates, legal links, and `©2026 Searon Maharjan`.

---

## ✦ Local Development

### Prerequisites
- Node.js `20.x` or `24.x`
- npm `10.x` or `11.x`

### Quick Start
```bash
# Clone the repository
git clone https://github.com/searonm/portfolio.git
cd portfolioweb

# Install dependencies (respects .npmrc ignore-scripts for security)
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Linting
```bash
# Run ESLint validation
npm run lint

# Compile optimized static output
npm run build

# Start production server locally
npm run start
```

---

## ✦ Vercel Deployment

This project is optimized out-of-the-box for **Vercel Edge Network**.

### Option A: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B: Deploy via GitHub / Vercel Dashboard
1. Push your repository to GitHub / GitLab.
2. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Import the `portfolioweb` repository.
4. Framework Preset will automatically detect **Next.js**.
5. Click **"Deploy"**.

---

## ✦ Impeccable & Apple Design Audit

- **WCAG 2.2 Level AA/AAA Contrast**: All body text achieves 17.5:1 contrast against `#050505`. Secondary captions achieve 5.5:1+.
- **Touch Target Floor**: All interactive controls conform to Apple HIG standards (minimum 44×44pt on mobile).
- **Reduced Motion**: Full compliance with `prefers-reduced-motion: reduce`, replacing spatial kinetics with instantaneous state transitions.
- **Responsiveness**: Precision layouts tested across 375px (mobile), 768px (tablet), and 1440px+ (desktop).
- **SEO & Social Graph**: Structured JSON-LD schema (`Person`), Open Graph image generator (`/opengraph-image`), and complete semantic landmarks.
