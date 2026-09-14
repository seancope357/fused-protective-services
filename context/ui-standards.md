# UI/UX Design System & Accessibility — Fused Protective Services

This document details the visual design language, color token taxonomy, typography scale, motion physics, panel contrast rules, and WCAG 2.1 AA accessibility standards for the **Fused Protective Services** platform.

---

## 🎨 Aesthetic Identity: Tactical Luxury

Fused Protective Services embodies a **Tactical Military-Grade Luxury** aesthetic:

* **Atmosphere:** Deep obsidian/carbon surfaces, metallic brushed-gold accents, glowing amber/emerald indicators, and razor-sharp typographic telemetry.
* **Tone:** Uncompromising authority, military discipline, and ultra-high-net-worth discretion.
* **Visual Restraint:** Avoid flashy consumer-grade novelty. Every element should feel engineered, deliberate, and mission-critical.

---

## 🪙 Design Tokens & Color Taxonomy (`src/styles/tokens.css`)

All color values derive strictly from the official 3D Brushed Gold Shield logo plate:

### 1. The Gold Spectrum
```css
--logo-gold-shadow:     #72542b;  /* Deepest bronze shadow */
--logo-gold-warm:       #87693b;  /* Warm metallic undertone */
--logo-gold-core:       #a1814c;  /* Primary gold midtone */
--logo-gold-bevel:      #ba9857;  /* Highlight bevel edge */
--logo-gold-glint:      #c6a25c;  /* Bright reflective glint */
--logo-gold-highlight:  #dfc07b;  /* High specular shine */
--logo-gold-specular:   #f7e5b2;  /* Pure metallic light reflection */
```

### 2. Metallic Gradients
```css
/* Brushed 45-degree tactical sheen */
--gradient-gold-brushed: linear-gradient(135deg, #f7e5b2 0%, #ba9857 25%, #a1814c 50%, #87693b 75%, #72542b 100%);

/* Vertical metallic plate reflection */
--gradient-gold-metallic: linear-gradient(180deg, #ffffff 0%, #f7e5b2 20%, #c6a25c 45%, #ba9857 70%, #72542b 100%);
```

### 3. Surface & Void Scale
```css
--color-void:             #050504;                 /* Absolute base background */
--color-surface-base:     #090a09;                 /* Root page surface */
--color-surface-elevated: #111211;                 /* Raised container surface */
--color-surface-card:     rgba(18, 19, 18, 0.86);  /* Frosted card backing */
--color-surface-card-hover: rgba(26, 28, 26, 0.98);/* Hover elevation */
--color-surface-glass:    rgba(255, 255, 255, 0.03);/* Subtle glass highlight */
```

### 4. Section Scrims (Contrast Over Canvas)
The animated WebGL particle mesh and voxel canvas sit behind page content. Legibility is strictly guaranteed via semi-opaque section scrims:
* `--surface-section-sunken`: `rgba(9, 10, 9, 0.75)`
* `--surface-section-deep`: `rgba(9, 10, 9, 0.80)`
* `--surface-section-framed`: `rgba(12, 13, 12, 0.85)`

> [!NOTE]
> **Why `mix-blend-mode` is Forbidden Over Canvas:**
> The `z-index: 1` content wrapper forms its own CSS stacking context. Blend modes cannot reach through this boundary to composite against the WebGL canvas. Contrast must always be achieved through opaque backing panels, dark scrims, and frosted glass filters.

---

## 📐 Typography & Font Hierarchy

* **Primary Typeface:** `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif`
* **Self-Hosted Faces:** Cinzel, Outfit and JetBrains Mono are served from `assets/fonts/` and declared in `src/styles/base.css`. There are no Google Fonts requests; the marketing-site CSP allows no third-party origin.
* **Heading Style:** Bold, architectural, high-contrast, uppercase where tactical codes are displayed.
* **Tactical Callout Format:** Code prefixes (e.g. `DIV-01 // PPO`, `POS-01 // PPO`) must feature:
  * Monospaced or structured uppercase sans-serif
  * `letter-spacing: 0.12em` to `0.18em`
  * High-visibility badge borders (`--border-gold-subtle`)

---

## 🛡️ Bespoke Gold SVG Iconography

The platform uses custom, hand-crafted gold SVG emblems located in `src/data/icons.mjs` (`executive`, `event`, `commercial`, `construction`, `estate`, `emergency`, etc.).

### The 3D Gyroscopic Icon Decision (2026-08-26)
On 2026-08-26, a prototype featuring live Three.js gyroscopic 3D sigils in the bookshelf icon slots was evaluated and **rejected on sight**:
* At 48px square, 3D models read as muddy visual noise rather than crisp tactical emblems.
* Rendering multiple WebGL sub-contexts degraded frame rates on mobile devices.
* **Standing Decision:** The bespoke 2D gold SVG library is the permanent standard. The bookshelf's visual polish budget is allocated to motion (`--ease-studio`, smooth sliding rails, staggered payload cascade), not 3D icons.

---

## 🖼️ Brand Asset Set (`assets/`)

Every file below is a **derivative of one master**, `assets/logo.png` (1000×1000, the
photographed 3D brushed-gold shield plate). The master is the only file a designer ever
replaces. Derivatives are generated **once**, by hand, and committed.

| File | Size | Bytes | Job |
| :--- | :--- | ---: | :--- |
| `logo.webp` | 1000×1000 | 133,962 | Brand plate (nav, hero, footer, invoice) **and** the voxel forge texture — one fetch serves both |
| `logo-512.png` | 512×512 | 160,453 | The portal's copy, mirrored to `app/public/logo.png` by `app/scripts/sync-shared.mjs` |
| `icon-32.png` | 32×32 | 575 | Favicon |
| `icon-180.png` | 180×180 | 7,676 | `apple-touch-icon` |
| `icon-512.png` | 512×512 | 48,895 | Large icon; the `schema.org` square `logo` |
| `og-card.png` | 1200×630 | 175,491 | OpenGraph + Twitter `summary_large_image` |
| `logo.png` | 1000×1000 | 1,095,464 | **Master. Not served** — no page links it. |

Paths are declared once in `src/data/site.mjs` (`logo`, `logoFallback`, `icons`, `ogCard`)
and `build.mjs` refuses to build if any of them is missing from the checkout.

### Regenerating

```sh
./scripts/build-assets.sh          # then: node build.mjs && node --test 'tests/*.test.mjs'
```

`build.mjs` is zero-dependency and **must never import an image library**. The script is
therefore not a build step: it uses pinned `npx sharp-cli@5.1.0` and `npx playwright@1.56.1`,
installs nothing into the repository, and exists so the work is reproducible — not so CI
can run it.

### Why the plate is full-resolution WebP

`js/logo-forge.js` shatters the plate into ~65k cubes. Two separate things were measured on
a real headless Chromium at 1× and 2× DPR, because they are commonly confused:

* **Cube count** comes from `GRID_ROWS = 256`, not from the source. The sampler box-filters
  the plate down to 256×256 whatever it is handed, and the master has no alpha channel, so
  all 65,536 cells become cubes — at every source resolution tested.
* **Sharpness** comes from the source, which is uploaded to the GPU whole and tiled across
  the cubes. Acutance of the settled emblem, against the 1000×1000 master at 2× DPR:

  | Source | Retained | Bytes |
  | :--- | ---: | ---: |
  | 1000² PNG (master) | 100% | 1,095,464 |
  | **1000² WebP q95** | **94.6%** | **133,962** |
  | 1000² WebP q90 | 84.3% | 66,520 |
  | 512² PNG | 78.4% | 157,501 |
  | 256² PNG | ~68% | 39,963 |

  Run-to-run variation is 0.6% (cube depths are randomised), so the losses are real signal.

So the plate shrank **by re-encoding, not by resizing**: q95 at full size is both smaller
than a 512 downscale and 16 points sharper. Do not "optimise" it by resizing.

### Why there is no `<picture>` fallback

`css/site.css` is built around `@layer`, which shipped in 2022 — a year and a half after
WebP became universal. A browser that cannot decode `logo.webp` cannot lay out the page it
sits on, so a PNG fallback would be dead weight.

### The social card is composed, not cropped

`scripts/og-card.mjs` typesets it — emblem, Cinzel wordmark on the
`--gradient-gold-metallic` ramp, `PROTECTIVE SERVICES` at `0.345em` tracking, a positioning
line, and the city strip — on `--color-void` with a single warm source behind the emblem.
Every word is read from `src/data/site.mjs`, so the card cannot drift from the page, and
the generator **fails rather than falling back to system fonts** if Cinzel and Outfit do not
load. The DPS licence number is absent: it was a placeholder when the card was composed, and an
image cannot carry the red flag the page uses to stay honest about it. It is real now
(2026-09-14); adding it to the card is a separate change.

The icons are cropped to the **shield alone** — at 32px the `FUSED` wordmark beneath it is
noise. Crop box, measured from the master: `extract 96 249 500 500`.

---

## ⏱️ Motion Physics & Kinetic Systems

Animations follow real-world physical inertia curves defined in `tokens.css`:

| Token | Cubic Bezier | Behavioral Purpose |
| :--- | :--- | :--- |
| `--ease-studio` | `cubic-bezier(0.65, 0, 0.15, 1)` | Heavy sliding panels (bookshelf rail expansion, protocol transitions). Strong initial push with a long, settling glide. |
| `--ease-out-quint` | `cubic-bezier(0.22, 1, 0.36, 1)` | Elements arriving into the viewport (cards, badges). Instant deceleration with no bounce. |
| `--ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | Tactile interactive feedback (button presses, hover releases). |

### Scroll Reveal & Page Entrance
* Sections and cards carry `data-reveal` in the templates. `components/reveal.css` hides them (opacity 0, 26px drop) only under `@media (scripting: enabled)`, and `js/modules/reveal.mjs` adds `.is-revealed` on first intersection. No inline script gates it; a no-JS visitor sees a fully rendered page.
* Stagger is positional: sibling `[data-reveal]` elements trail by 80ms per `:nth-child`, capped at 400ms. Never set per-element delays inline.
* The careers hero is above the fold and uses a pure-CSS `careersHeroRise` entrance (eyebrow → title → lead → actions → metrics) instead of the observer.
* Under `prefers-reduced-motion`, `reveal.css` lifts the hidden state entirely so nothing waits on a scroll event.

### The Assembly Dual Clocks
* **Intro copy:** The opening hero displays “Protection is a thousand moving parts.” without the “FPS // Assembly Protocol” badge, removed at Sean's request on 2026-09-14 to reduce clutter and avoid visitor-facing implementation jargon.
* **Scroll indicator:** Display “SCROLL” with the existing downward arrow. Preserve the cue's fade as scrolling begins; “TO ASSEMBLE” was removed at Sean's request on 2026-09-14.
* `--assembly`: Bound to viewport scroll offset (`0.0000` to `1.0000`). Used for pacing copy beat opacities.
* `--assembly-settled`: Bound to physical camera matrix convergence. The only clock that may trigger full-scene completion.

### Visitor-Facing Copy Decisions
* **Careers application header** (`src/templates/careers/apply.mjs`): the heading is “OFFICER APPLICATION” with no badge above it, and the lead says applications go “directly to Fused Protective Services.” The “COMMAND INTAKE” badge and the word “TRANSMIT” were removed, and applications are no longer addressed to Cameron Harrell by name, at Sean's request on 2026-09-14. The executive-interview vetting stage (“Executive Interview with Fused Leadership”), its sign-off line, the careers `keywords`, and the post-submit confirmation (“Application Received”, in `js/modules/careers.mjs`) name the company too. Visitor-facing careers copy never names a person.
* **Keep implementation jargon off client-facing explanations.** The hero badge, the “TO ASSEMBLE” scroll wording, the How It Works tactical badges and terminal logs, and the careers intake badge were all removed on 2026-09-14 for the same reason.

---

## 📱 Portal responsive rules (`app/`, SPEC-012)

The portal's owner runs it from a phone. These rules are what keep every screen usable at 320px
without anyone having to remember them page by page.

* **Mobile-first, two breakpoints.** A rule with no media query is a phone rule. `min-width: 600px`
  brings back tables and multi-column forms; `min-width: 1024px` swaps the tab bar for the sidebar.
  Never write a `max-width` query. The calendar's month grid appears only from 1024px; below that it is an agenda.
* **Nothing scrolls sideways.** Only an inner `overflow-x: auto` container may (a filter strip, a
  paper's line items). Grid and flex children carry `min-width: 0`; user text that can be long wraps.
* **Touch targets are 44px.** Buttons, chips, tabs, sheet links, summaries and inputs are at least
  44px tall on phones and tablets. `.btn--sm` and `.chip` drop to 34px only on a desktop with a fine
  pointer. WCAG 2.2 SC 2.5.8 sets 24px as the floor; 44px (Apple HIG) is this product's standard.
* **Inputs are 16px.** iOS Safari zooms the page on focusing any field under 16px. Give every field
  the right `type`, `inputMode`, `autoComplete` and `enterKeyHint`.
* **One primary action per screen**, in `PageHead primary`. Below 1024px it is pinned above the tab
  bar; destructive actions are never primary.
* **Lists are `DataTable`.** One `primary` column holds the row's link (the phone card's title and tap
  target); `hide: 'phone' | 'tablet'` removes what a small screen does not need.
* **Status colour comes from tokens** (`--status-good`, `--status-bad`, `--status-warn` and the
  `.status-*` utilities), never inline hex.
* **Operator language.** Visible text never names environment variables, repository paths or
  implementation details; put those in a collapsed "Technical detail" `Disclosure`.
* **Verify with the capture suite, not by eye alone:** `app/tests/responsive.test.ts` signs in to a
  seeded local stack and checks every screen at 320, 375, 768 and 1280px (`app/scripts/README-demo.md`).

---

## ♿ Accessibility Baseline (WCAG 2.1 AA)

All user interface elements strictly adhere to the accessibility baseline established during the 2026 rebuild.

> [!IMPORTANT]
> **This section describes intent. [`docs/A11Y-AUDIT.md`](../docs/A11Y-AUDIT.md) describes measured
> reality, and where the two disagree the audit is right.** The 2026-09-14 audit found 48 automated
> and 12 manual violations against this baseline — including two defects in the very affordances
> described below. Read it before trusting a claim on this page.

### 0. Standing obligation

Any change to the nav or drawer, the bookshelf, the protocol tablist, the assessment quiz, the
estimator, either intake form, the careers filters or accordion, or the scroll-driven intro requires
re-running the manual audit in [`docs/A11Y-AUDIT.md`](../docs/A11Y-AUDIT.md) and updating its date.
The `a11y` CI job covers the automated third — colour contrast, names, roles, landmarks — and covers
none of the above.

**Contrast is measured against the composited background, not the token.** Several surfaces are
translucent (`--color-surface-card` is `rgba(18,19,18,0.86)` over `--color-void`), so a ratio
computed against the nominal hex is wrong. Large text (≥24px, or ≥18.66px bold) is held to 3:1 and
everything else to 4.5:1; `.standard-index` passes only because it is 34px at weight 900.

**Token decisions** (`docs/A11Y-AUDIT.md` Part E, items 1 and 8):
1. **Decided 2026-09-14 (Sean): `--text-tertiary` is `#8f8a86`** (was `#78716c`). Measured 5.97:1 on
   the void, 5.84:1 on the sunken surfaces, 5.74:1 on framed; the old value was 4.08–4.25:1 and failed
   everywhere it was used. Applies to the site and the portal (the portal imports `tokens.css`).
2. **Still open:** the gold ramp fails as an interactive face: the 75% stop is 3.99:1 and the 100% stop 2.93:1
   against `--color-void`. Recommendation is an additive `--gradient-gold-brushed-ui` clamped at
   `--logo-gold-core` (`#a1814c`), leaving the decorative gradient untouched.

Record the outcome here when decided — this document owns the gold tokens.


### 1. Semantic Interactive Controls
* **Real `<button>` Elements:** All clickable triggers (bookshelf spine rails, estimator tier selectors, quiz cards) are native `<button>` elements with `type="button"`. No `<div onclick>` constructs exist.
* **Native Accordions:** The FAQ section uses native `<details>` and `<summary>` elements, inheriting full keyboard and screen-reader accessibility from the browser engine.

### 2. ARIA Tablist Pattern (Protocol Section)
The four-step “How It Works” section preserves the WAI-ARIA tablist pattern. Use client-facing step labels, a short explanation, a quote CTA, and a simple “What you can expect” list styled with existing dark/gold tokens. Do not render tactical badges, technical metadata strips, or simulated terminal logs.

The interaction follows:
* Tab container: `role="tablist"`
* Individual tab buttons: `role="tab"`, `aria-selected="true|false"`, `aria-controls="panel-id"`
* Tab panels: `role="tabpanel"`, `tabindex="0"`, `aria-labelledby="tab-id"`
* **Keyboard Navigation:** Full arrow-key navigation (`ArrowRight`, `ArrowLeft`, `Home`, `End`) implemented in `js/modules/protocol.mjs`.

### 3. Forms & Labeling
* **Explicit Associations:** Every form input, select, and textarea is explicitly bound to a dedicated `<label for="...">`.
* **Live Regions:**
  * `#formStatus` is marked `aria-live="polite"` to announce dispatch confirmation codes without throwing blocking `alert()` dialogs.
  * Quiz result recommendations dynamically update an ARIA live region.

### 4. Focus Visibility & Skip Links
* **Skip Link:** A high-contrast `.skip-link` sits off-screen at `-100%` and slides down into view on
  initial keyboard tab, targeting `#main` on every page. All four `<main>` elements carry
  `tabindex="-1"` — without it, activating the link leaves `document.activeElement` on `BODY` and only
  Chrome's sequential-focus-starting-point papers over it; VoiceOver and NVDA do not.
  *Corrected 2026-09-14 (A11Y-01/02):* `/` targeted `#capabilities` and `/careers` targeted
  `#open-postings` — both **inside** `<main>` but past the hero and past every primary CTA. The one
  affordance a keyboard or screen-reader visitor uses to reach the content skipped the calls to
  action. Treat this as a conversion invariant, not only an accessibility one.
* **Unified `:focus-visible` Style:**
  ```css
  :where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
      outline: 2px solid var(--logo-gold-specular);
      outline-offset: 3px;
      border-radius: var(--radius-sm);
  }
  ```

### 5. Reduced Motion Enforcement
When `prefers-reduced-motion: reduce` is active:
* CSS animations and transitions are clamped to `0.01ms`.
* Transition delays are explicitly zeroed (`transition-delay: 0s !important`) to prevent delayed cascading reveals from flashing.
* The WebGL voxel track collapses to a static, assembled emblem (`data-forge-fallback`).
