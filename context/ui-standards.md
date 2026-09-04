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
* **Heading Style:** Bold, architectural, high-contrast, uppercase where tactical codes are displayed.
* **Tactical Callout Format:** Code prefixes (e.g. `DIV-01 // PPO`, `RECON_DIAGNOSTIC_V4.LOG`) must feature:
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
* `--assembly`: Bound to viewport scroll offset (`0.0000` to `1.0000`). Used for pacing copy beat opacities.
* `--assembly-settled`: Bound to physical camera matrix convergence. The only clock that may trigger full-scene completion.

---

## ♿ Accessibility Baseline (WCAG 2.1 AA)

All user interface elements strictly adhere to the accessibility baseline established during the 2026 rebuild:

### 1. Semantic Interactive Controls
* **Real `<button>` Elements:** All clickable triggers (bookshelf spine rails, estimator tier selectors, quiz cards) are native `<button>` elements with `type="button"`. No `<div onclick>` constructs exist.
* **Native Accordions:** The FAQ section uses native `<details>` and `<summary>` elements, inheriting full keyboard and screen-reader accessibility from the browser engine.

### 2. ARIA Tablist Pattern (Protocol Section)
The 4-stage deployment protocol implements the complete WAI-ARIA tablist pattern:
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
* **Skip Link:** A high-contrast `.skip-link` sits off-screen at `-100%` and slides down into view on initial keyboard tab, skipping directly to main content.
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
