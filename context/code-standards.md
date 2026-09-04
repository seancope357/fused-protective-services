# Engineering & Code Standards — Fused Protective Services

This document establishes the non-negotiable coding conventions, security invariants, CSS layering rules, and architectural constraints governing all code in this repository.

---

## 🔒 Security & Templating Invariants

### 1. Escaping is the Default, Not Opt-In
All HTML generation relies on the tagged template primitive `html` from `src/lib/html.mjs`.

* **Automatic Escaping:** Every dynamic interpolation (`${value}`) is sanitized against `&`, `<`, `>`, `"`, and `'`.
* **The `raw()` Exception:** Only call `raw()` on markup this repository generates internally (such as SVG icons from `src/data/icons.mjs` or sub-templates).
* **Never Pass User Input to `raw()`:** Untrusted data must always flow through standard interpolation to eliminate XSS vectors.
* **No HTML Entities in Data Modules:** Never store HTML entities (e.g., `&amp;`, `&quot;`, `&lt;`) in `src/data/`. Write literal characters (`&`, `"`, `<`). If an entity is stored in data, the template compiler will double-escape it (`&amp;amp;`).

```javascript
// ❌ INCORRECT (Double escapes to &amp;amp;)
heading: 'Executive &amp; VIP Protection'

// ✅ CORRECT (Escaped once to &amp; by html tagged template)
heading: 'Executive & VIP Protection'
```

---

## ⚡ DOM & JavaScript Architecture

### 1. Zero Inline Event Handlers, Zero Inline Styles
The repository ships with **zero** inline JavaScript attributes (`onclick=...`, `onchange=...`) and **zero** inline `style="..."` attributes (with the sole exception of the dynamic WebGL canvas `--assembly` property update in `logo-forge.js`).

* **Delegated Event Listeners:** Interactive surfaces must attach delegated event listeners in their corresponding `js/modules/*.mjs` module.
* **Semantic Target Binding:** Use `data-*` attributes for JavaScript binding rather than styling classes:
  ```html
  <!-- ✅ Semantic button with data-action binding -->
  <button type="button" class="btn btn-gold" data-action="deploy" data-division="Executive & VIP Close Protection (Level IV PPO)">
      Deploy Detail
  </button>
  ```

### 2. Client Data Reads From the Build Island
Never hardcode division names, phone numbers, or hourly rates inside `js/`.

* The compiler serializes the necessary data slice into `<script type="application/json" id="fps-config">`.
* JavaScript modules read this island via `js/modules/config.mjs`:
  ```javascript
  import { config } from './config.mjs';
  const rate = config.estimator.tiers.find(t => t.id === tierId).rate;
  ```

### 3. File Size Budgets & Upstream Invariants
* **Strict 300 LOC Module Limit:** Style modules (`src/styles/components/*.css`) and template modules (`src/templates/*.mjs`) should not exceed ~300 lines of code. If a module grows beyond this limit, refactor it into cohesive sub-components.
* **The `logo-forge.js` Exception:** `js/logo-forge.js` is deliberately maintained whole at ~530 LOC. It is an upstream port of the *Pixel Scroll Forge* engine. Slicing it would make re-syncing upstream bug fixes (e.g., frame-delta clamping, seam overlap repairs) a complex merge instead of a direct diff. Prefer upstream parity over local modularization.

---

## 🎨 CSS Architecture & Layering Rules

### 1. The Single `@layer` Declaration
The generated stylesheet declares `@layer` once at the very top:

```css
@layer tokens, base, layout, components, utilities;
```

This ensures a strict specificity ladder across the entire platform:
1. `tokens`: Defines design tokens and variables (`:root`).
2. `base`: Global element resets, typography, and default focus rings.
3. `layout`: Section grids, headers, footers, and viewports.
4. `components`: Isolated component classes (`.btn`, `.bookshelf-spine`).
5. `utilities`: Overrides (e.g. `.sr-only`) that must always defeat component styles without requiring `!important`.

### 2. Explicit Cascade Order (`STYLE_ORDER`)
CSS concatenation is strictly controlled by the `STYLE_ORDER` array in `build.mjs`. Never rely on filesystem or alphabetical directory ordering:

```javascript
// build.mjs
const STYLE_ORDER = [
    'tokens.css',
    'base.css',
    'layout.css',
    'components/icons.css',
    'components/buttons.css',
    // ... Explicit component sequence ...
    'components/dispatch-bar.css',
    'components/footer.css',
    'utilities.css'
];
```

### 3. Cascade Rules Within Modules
In vanilla CSS, rules placed after a `@media` query block override declarations within that block for the same breakpoint.

* **Example:** In `src/styles/components/bookshelf.css`, the `.spine-rail` button reset must sit *ahead* of the `992px` desktop layout block to ensure the mobile layout styles do not bleed into the expanded desktop view.

---

## ⏱️ Deterministic Builds (Zero Drift)

All builds must produce byte-identical output across environments, developers, and calendar years:

* **Static `copyrightYear`:** Stored as an explicit integer (`copyrightYear: 2026` in `src/data/site.mjs`). Never compute it using `new Date().getFullYear()`. Otherwise, `node build.mjs --check` would fail on January 1st due to a date change rather than a code change.
* **Sorted Object Keys:** When serializing JSON configuration islands, ensure dictionary structures maintain stable key ordering.
* **Deterministic Formatting:** Build scripts normalize line endings (`\n`) and use consistent spacing.
