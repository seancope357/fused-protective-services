# Accessibility audit — Fused Protective Services

**Date:** 2026-09-14 · **Spec:** [SPEC-008](../specs/SPEC-008-accessibility-gate.md) · **Gate:** `GO_LIVE.md` → E4
**Conformance target:** WCAG 2.1 AA, as claimed by [`context/ui-standards.md`](../context/ui-standards.md)
**Tester:** AXE (automated agent), driving real Chromium — Playwright 1.56.1 / Chromium 141.0.7390.37,
and `@axe-core/cli` 4.10.2 (axe-core 4.10.3) on Chrome for Testing 153.0.8010.36.
**Surfaces:** static marketing site served by `python3 serve.py` (port 5050); portal built with
`pnpm build` and served by `pnpm start` (port 3300).

---

## ⚠️ The CI gate is STAGED, not armed — and that is temporary

The `a11y` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and
pull request, scans every public page and the portal sign-in screen, and **prints every violation it
finds**. It carries `continue-on-error: true`, so today it reports without blocking.

**It flips to blocking in the follow-up that lands the fixes below.** That change deletes one line
(`continue-on-error: true`) and adds `a11y` to the required-checks list. Nothing else about the job
changes.

The reason for staging is narrow and worth stating plainly: every automated violation in this report
lives in `src/styles/**` and `src/templates/**`, which this change does not own — SPEC-007 holds the
lock on them this wave and SPEC-006 rewrites the styles next. A gate that fails `main` on defects
nobody is currently permitted to fix trains the team to ignore a red check, and a check everyone
ignores is worse than no check at all. A job that runs and reports honestly is worth having today.

**No axe rule is disabled anywhere** — not in the workflow, not in `app/tests/a11y.test.ts`, not in
any config. Staging the gate is not the same as suppressing findings, and the distinction is the
whole point. If a future change is tempted to add `--disable`, add a finding to this document
instead.

---

## Reproducing this audit

```bash
# static site
python3 serve.py &
npx --yes @puppeteer/browsers@2.10.10 install chrome@153.0.8010.36       --path /tmp/cft
npx --yes @puppeteer/browsers@2.10.10 install chromedriver@153.0.8010.36 --path /tmp/cft
npx --yes @axe-core/cli@4.10.2 \
  http://localhost:5050/ http://localhost:5050/careers http://localhost:5050/privacy \
  http://localhost:5050/terms http://localhost:5050/sms-consent http://localhost:5050/invoice \
  --chrome-path       /tmp/cft/chrome/linux-153.0.8010.36/chrome-linux64/chrome \
  --chromedriver-path /tmp/cft/chromedriver/linux-153.0.8010.36/chromedriver-linux64/chromedriver \
  --chrome-options="no-sandbox,disable-dev-shm-usage,disable-gpu" \
  --tags wcag2a,wcag2aa,wcag21a,wcag21aa --load-delay 2500 --exit

# portal
cd app && pnpm build && PORT=3000 pnpm start &
A11Y_PORTAL_URL=http://localhost:3000 pnpm exec vitest run tests/a11y.test.ts
```

**Chrome and ChromeDriver must be the same Chrome-for-Testing build.** `@axe-core/cli` drives Chrome
through Selenium, and a ChromeDriver whose major version differs from the browser refuses to start a
session. Both version strings are pinned together in the workflow's `env:` block; change them as a
pair or the gate stops running.

### Why the scan runs twice

At rest, `src/styles/components/reveal.css` holds every `[data-reveal]` element at `opacity: 0` until
it intersects the viewport, and **axe skips what it cannot see**. A default-state scan of `/` reports
5 violating nodes; the same page under `prefers-reduced-motion` — where `reveal.css` lifts the hidden
state entirely — reports 10. The workflow therefore runs both passes, the second with Chrome's
`--force-prefers-reduced-motion`. A single default-state scan would under-report this site by roughly
half and would have been quietly dishonest.

---

## Summary

### Automated (axe-core, WCAG 2.1 AA tag set)

| Impact | Distinct violating nodes |
| :--- | ---: |
| critical | 0 |
| **serious** | **48** |
| moderate | 0 |
| minor | 0 |
| **Total** | **48** |

Every one is rule `color-contrast` (WCAG 1.4.3 Contrast (Minimum)). By page:

| Page | Nodes |
| :--- | ---: |
| `/` | 10 |
| `/careers` | 19 |
| `/privacy` | 6 |
| `/terms` | 6 |
| `/sms-consent` | 6 |
| `/invoice` | 1 |
| portal `/login` | **0** |

42 of the 48 come from a **single token**, `--text-tertiary`. Fixing that one value clears 87% of the
automated backlog.

### Manual (what axe cannot check)

| ID | Severity | Area |
| :--- | :--- | :--- |
| [A11Y-01](#a11y-01) | Serious | Skip link overshoots `#main` on `/` and `/careers` |
| [A11Y-02](#a11y-02) | Serious | Skip-link target is not focusable — focus is dropped to `<body>` |
| [A11Y-03](#a11y-03) | Serious | Careers filter claims `role="tablist"` but implements none of the pattern |
| [A11Y-04](#a11y-04) | Serious | Intake form has no programmatic error association |
| [A11Y-05](#a11y-05) | Serious | Gold-gradient button labels fail AA over the gradient's dark end |
| [A11Y-06](#a11y-06) | Moderate | `/invoice` scrolls horizontally at 320px |
| [A11Y-07](#a11y-07) | Moderate | Portal `/login` has no `<h1>`, no headings, no `<main>` |
| [A11Y-08](#a11y-08) | Moderate | Careers filter result change is announced to nobody |
| [A11Y-09](#a11y-09) | Minor | Protocol tabpanels lack the `tabindex="0"` the standards doc claims |
| [A11Y-10](#a11y-10) | Minor | Estimator slider label re-announces its own value |
| [A11Y-11](#a11y-11) | Minor | `data-placeholder` attribute is double-escaped (no a11y impact — see [Part D](#part-d)) |
| [A11Y-12](#a11y-12) | Minor | `.forge-cue-arrow` relies on the blanket reduced-motion clamp |

---

## Part A — Automated findings (all `color-contrast`, all serious)

### A-01 · `--text-tertiary` is below AA at every size it is used — 42 nodes · ✅ fixed 2026-09-14 (`#8f8a86`, approved by Sean)

**Rule:** `color-contrast` · **WCAG:** 1.4.3 (AA) · **Impact:** serious
**Root cause:** `src/styles/tokens.css:42` — `--text-tertiary: #78716c;`

`#78716c` never reaches 4.5:1 on any surface in this palette. Measured:

| Background | Ratio | Needs |
| :--- | ---: | ---: |
| `#020302` (footer) | 4.31 | 4.5 |
| `#050504` (page) | 4.25 | 4.5 |
| `#080908` | 4.16 | 4.5 |
| `#111211` (card) | 3.91 | 4.5 |
| `#151615` (prequal item) | 3.78 | 4.5 |
| `#04060a` | 4.23 | 4.5 |

Every consumer is text at 11–13px, so the large-text 3:1 allowance never applies.

**Affected selectors, with the rule that sets the colour:**

| File:line | Selector | Pages | Nodes |
| :--- | :--- | :--- | ---: |
| `src/styles/components/footer.css:42` | `.footer-menu--legal a` | all 5 | 15 |
| `src/styles/components/footer.css:94` | `.footer-disclaimer` | all 5 | 5 |
| `src/styles/components/footer.css:119` | `.footer-credit` | all 5 | 5 |
| `src/styles/components/careers.css:428` | `.position-license` | `/careers` | 5 |
| `src/styles/components/careers.css:102` | `.careers-metric-card .metric-lbl` | `/careers` | 4 |
| `src/styles/components/careers.css:164` | `.prequal-helper` | `/careers` | 3 |
| `src/styles/components/careers.css:657` | `.form-disclaimer` | `/careers` | 1 |
| `src/styles/components/careers.css:336` | `.pay-scale-unit` | `/careers` | 1 |
| `src/styles/components/legal.css:18` | `.legal-meta` | 3 legal pages | 3 |

**Fix — one line:**

```css
/* src/styles/tokens.css:42 */
--text-tertiary: #8f8a86;   /* was #78716c */
```

`#8f8a86` measures **5.31:1 on the worst background (`#151615`)** and 5.50–6.05 elsewhere, so every
consumer above clears AA with headroom. It stays inside the existing stone ramp (it sits between
`--text-tertiary` and `--text-secondary: #a8a29e`) and reads as the same muted tone.

The bare minimum that passes is `#86807b` (4.65 on `#151615`), but it leaves 0.15 of margin — one
future surface-tint tweak away from failing again. Prefer `#8f8a86`.

> **This is a token change, and `context/ui-standards.md` owns the tokens.** Per SPEC-008's *Open
> decisions*, raising it rather than applying it silently: the recommendation above is a lightening
> of a muted grey by roughly one ramp step and preserves the design, but it needs SPEC-006/the
> design owner to accept it. **Decision requested.**

### A-02 · `.standard-index` fails even the large-text threshold — 4 nodes

**Rule:** `color-contrast` · **WCAG:** 1.4.3 (AA) · **Impact:** serious
**File:** `src/styles/components/standards.css:46`
**Selector:** `.standard-card:nth-child(1..4) > .standard-index`
**Measured:** `rgba(186, 152, 87, 0.35)` composites to `#4c412a` on `#111211` = **1.87:1**; at 34px
bold the requirement is 3:1.

**Fix:**

```css
/* src/styles/components/standards.css:46 */
color: rgba(186, 152, 87, 0.62);   /* was 0.35 — composites to ~#7a653d, 3.31:1 on #111211 */
```

Measured alpha ramp on `#111211`: 0.35 → 1.87 · 0.50 → 2.59 · 0.55 → 2.90 · **0.60 → 3.20** ·
0.65 → 3.57. Use 0.62 for margin.

These elements carry `aria-hidden="true"` and are decorative ordinals. WCAG 1.4.3 does exempt pure
decoration — but they are *visible text a sighted low-vision user reads as numbering*, the exemption
is arguable rather than clear, and axe cannot make that judgement. **Raise the alpha; do not
disable the rule.**

### A-03 · `/invoice` portal link uses the browser default link colour — 1 node

**Rule:** `color-contrast` · **WCAG:** 1.4.3 (AA) · **Impact:** serious
**Selector:** `/invoice` → `p:nth-child(3) > a` (the `…/portal/invoices` link)
**Measured:** `#0000ee` on `#050504` = **2.16:1** — the worst ratio on the site.

**Cause:** `invoice.html` loads only `css/invoice.css`, whose `INVOICE_STYLE_ORDER`
(`build.mjs:71`) includes `components/legal.css`. That file styles `.form-consent a` but has **no
rule for `.inv-moved a`**, so the link falls back to the user-agent stylesheet.

**Fix — add to `src/styles/components/legal.css`, beside the existing `.inv-moved` rules (~line 89):**

```css
.inv-moved a {
    color: var(--logo-gold-highlight);   /* #dfc07b — 11.62:1 on #050504 */
}
```

This matches `.form-consent a` two rules above, so the page gains no new colour decision.

### A-04 · `.estimator-disclaimer` uses an off-palette hard-coded slate — 1 node

**Rule:** `color-contrast` · **WCAG:** 1.4.3 (AA) · **Impact:** serious
**File:** `src/styles/components/estimator.css:158`
**Selector:** `/` → `.estimator-disclaimer`
**Measured:** `#64748b` on `#04060a` = **4.26:1** at 11px; needs 4.5.

`#64748b` is Tailwind slate-500 — a blue-grey that belongs to no token in `tokens.css`. It is the
only hard-coded text colour of its kind in the components directory.

**Fix:**

```css
/* src/styles/components/estimator.css:158 */
color: var(--text-tertiary);   /* was #64748b */
```

With A-01 applied this measures 5.94:1 on `#04060a`, and it removes an off-token colour at the same
time. If A-01 is rejected, use `#94a3b8` (7.91:1) instead.

---

## Part B — Manual findings (axe cannot check these)

<a id="a11y-01"></a>
### A11Y-01 · The skip link overshoots `#main` on the two pages that matter most — **Serious**

**WCAG:** 2.4.1 Bypass Blocks (A)
**Files:** `src/templates/page.mjs:74`, `src/templates/careers/page.mjs:48`

| Page | Current target | Lands on | What it skips past |
| :--- | :--- | :--- | :--- |
| `/` | `#capabilities` | the divisions bookshelf | the whole intro **and the entire hero**, including both primary CTAs ("Request Immediate Security Detail", "60-Sec Threat Assessment") |
| `/careers` | `#open-postings` | the job board | the careers hero, the pre-qualification quiz and the benefits section |
| `/privacy`, `/terms`, `/sms-consent` | `#main` | ✅ correct | — |
| `/invoice` | `#invoice-export` | ✅ correct (that id **is** the `<main>`) | — |

A "Skip to main content" link that deposits the visitor three sections into main content is not
bypassing a block — it is hiding content from the one group of users who depend on it. On `/` this
means a keyboard or screen-reader visitor who uses the skip link **never encounters the primary call
to action at all**.

SPEC-008 states the requirement directly: *"Verify the skip link is the first focusable element and
lands on `#main`."* The first half holds on all six pages (see [Part C](#part-c)); the second fails
on two.

**Fix:**

```diff
- src/templates/page.mjs:74
-     <a href="#capabilities" class="skip-link">Skip to main content</a>
+     <a href="#main" class="skip-link">Skip to main content</a>

- src/templates/careers/page.mjs:48
-     <a href="#open-postings" class="skip-link">Skip to open postings</a>
+     <a href="#main" class="skip-link">Skip to main content</a>
```

Both pages already render `<main id="main">`, so no other markup changes. Apply A11Y-02 in the same
edit. `tests/skip-link.test.mjs` already asserts the target resolves to an id inside `<main>`;
tighten it to `#main` exactly once this lands.

<a id="a11y-02"></a>
### A11Y-02 · The skip-link target is not focusable, so focus is dropped to `<body>` — **Serious**

**WCAG:** 2.4.3 Focus Order (A)
**Files:** `src/templates/page.mjs`, `src/templates/careers/page.mjs`, `src/templates/legal/page.mjs`,
`src/templates/invoice/page.mjs` — every `<main>`/skip target on the site

**Measured, all six pages:** after activating the skip link, `document.activeElement` is `BODY`.
No skip target on the site carries `tabindex="-1"`.

Chrome papers over this with its *sequential focus navigation starting point*: the next <kbd>Tab</kbd>
after activating the link does continue from the target (verified — on `/` the next Tab lands on the
first spine rail inside `#capabilities`). But that is a browser convenience, not a guarantee. Screen
readers that move their reading cursor with **focus** — VoiceOver and NVDA among them — do not follow
a starting point they were never told about, so the announcement stays where it was and the user is
told nothing happened.

**Fix — add `tabindex="-1"` to each skip destination:**

```diff
- src/templates/page.mjs
-     <main id="main">
+     <main id="main" tabindex="-1">

- src/templates/careers/page.mjs
-     <main id="main">
+     <main id="main" tabindex="-1">

- src/templates/legal/page.mjs
-     <main id="main" class="legal-main">
+     <main id="main" class="legal-main" tabindex="-1">

- src/templates/invoice/page.mjs
-     <main class="inv-moved" id="invoice-export">
+     <main class="inv-moved" id="invoice-export" tabindex="-1">
```

`base.css:77` already scopes its focus ring to `:focus-visible`, so a programmatically focused
`<main>` will not draw a visible outline. No CSS change is needed and no visual change results.

<a id="a11y-03"></a>
### A11Y-03 · The careers filter announces `role="tablist"` and implements none of the pattern — **Serious**

**WCAG:** 4.1.2 Name, Role, Value (A) · **Related axe rule:** `aria-required-children` (passes, because
the markup is *structurally* a tablist — it is the behaviour that is missing)
**File:** `src/templates/careers/positions.mjs:43–54` (markup) · `js/modules/careers.mjs:18–46` (behaviour)
**Selector:** `/careers` → `.filter-tabs-track[role="tablist"]`, `#tab-all … #tab-operations`

Measured against the ARIA Authoring Practices tabs pattern:

| Requirement | Status |
| :--- | :--- |
| `role="tablist"` on the container | ✅ present |
| `role="tab"` on each of the 6 buttons | ✅ present |
| `aria-selected` maintained | ✅ present |
| **`aria-controls` pointing at a panel** | ❌ **absent on all 6** |
| **A `role="tabpanel"` to control** | ❌ **0 exist on the page** |
| **Roving tabindex (one tab stop)** | ❌ all six are `tabindex=0` |
| **<kbd>←</kbd>/<kbd>→</kbd>/<kbd>Home</kbd>/<kbd>End</kbd>** | ❌ `initFilters` binds `click` only — <kbd>→</kbd> from `#tab-all` does not move focus |

A screen-reader user is told "tab, 1 of 6" and then finds none of the behaviour that promise implies:
arrow keys do nothing, every tab is a separate stop, and activating one changes content that no
`aria-controls` points at. The control is honest as a **filter button group** and dishonest as a
tablist.

**Fix — drop the tab roles rather than build four panels that do not exist.** The controls filter a
list in place; they do not switch panels.

```diff
  src/templates/careers/positions.mjs:43
- <div class="filter-tabs-track" role="tablist" aria-label="Filter Positions by Category">
+ <div class="filter-tabs-track" role="group" aria-label="Filter positions by category">

  src/templates/careers/positions.mjs:46-52
  <button type="button" class="filter-tab-btn ${idx === 0 ? 'active' : ''}"
-         role="tab"
          id="tab-${cat.id}"
-         aria-selected="${idx === 0 ? 'true' : 'false'}"
+         aria-pressed="${idx === 0 ? 'true' : 'false'}"
          data-filter="${cat.id}">
```

```diff
  js/modules/careers.mjs:30-35
  track.querySelectorAll('.filter-tab-btn').forEach((b) => {
      b.classList.remove('active');
-     b.setAttribute('aria-selected', 'false');
+     b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add('active');
- btn.setAttribute('aria-selected', 'true');
+ btn.setAttribute('aria-pressed', 'true');
```

No CSS changes: `.filter-tab-btn.active` still drives the visual state, so the design is untouched.

*(Alternative, if the tab presentation is considered load-bearing: implement the full pattern —
wrap `#positionsContainer` in a `role="tabpanel"`, add `aria-controls`, add a roving tabindex and
arrow-key handling mirroring `js/modules/protocol.mjs`, which already does this correctly. That is
strictly more work for the same user outcome.)*

<a id="a11y-04"></a>
### A11Y-04 · The intake form has no programmatic error association — **Serious**

**WCAG:** 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA)
**Files:** `src/templates/quote.mjs:17–21` (the `field()` partial) · `js/modules/quote-form.mjs:49–52`
**Selector:** `/` → `#securityQuoteForm`

Measured after submitting the form empty:

| Property | Observed |
| :--- | :--- |
| Fields with a programmatic `<label for>` | **11 / 11 ✅** |
| Fields with `aria-describedby` | **0** |
| Fields with `aria-invalid` | **0** |
| In-page error nodes (`.form-error`, `role="alert"`) | **0** |
| `#formStatus` (the live region) content | **empty — nothing announced** |
| Focus after failed submit | moves to `#formName` ✅ (browser behaviour) |

The form is `novalidate` and `quote-form.mjs` calls `form.reportValidity()`, which draws a native
browser bubble. Those bubbles are transient, are dismissed by the next keystroke, appear on only the
*first* invalid field, and are not reliably surfaced by screen readers. Between submit and the user
noticing the bubble, **nothing in the accessibility tree says the submission failed.**

Labelling is genuinely good here — this is specifically about *errors*.

**Fix — three coordinated edits:**

1. `src/templates/quote.mjs` — give every field a hint slot:

```js
const field = ({ id, label, type = 'text', placeholder = '', required = false }) => html`
                        <div class="form-field">
                            <label for="${id}">${label}</label>
                            <input type="${type}" id="${id}" name="${id}" placeholder="${placeholder}"
                                   aria-describedby="${id}-error"${required ? ' required' : ''}>
                            <p class="form-error" id="${id}-error" role="alert" hidden></p>
                        </div>`;
```

2. `js/modules/quote-form.mjs:49–52` — replace `reportValidity()` with an in-page pass that writes
   the message, sets `aria-invalid="true"`, unhides the error node, moves focus to the first invalid
   field, and writes a summary into `#formStatus` (already `role="status" aria-live="polite"`):

```js
if (!form.checkValidity()) {
    const invalid = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
    for (const el of form.elements) {
        if (!el.willValidate) continue;
        const slot = document.getElementById(`${el.id}-error`);
        const bad = !el.checkValidity();
        el.setAttribute('aria-invalid', String(bad));
        if (slot) { slot.textContent = bad ? el.validationMessage : ''; slot.hidden = !bad; }
    }
    if (status) status.textContent = `${invalid.length} field${invalid.length === 1 ? '' : 's'} need attention before this can be sent.`;
    invalid[0]?.focus();
    return;
}
```

3. `src/styles/components/form.css` — add a `.form-error` rule. **It must not signal by colour
   alone** (WCAG 1.4.1): pair the crimson with a glyph or the word "Error", e.g.
   `content: '⚠ '` on `.form-error::before`. Verify the crimson used clears 4.5:1 on the form
   surface at its final size.

Apply the identical treatment to `#candidateApplicationForm`
(`src/templates/careers/apply.mjs`), which is `novalidate` with the same gap.

<a id="a11y-05"></a>
### A11Y-05 · Gold-gradient button labels fall below AA over the gradient's dark end — **Serious**

**WCAG:** 1.4.3 Contrast (Minimum) (AA)
**Files:** `src/styles/tokens.css` (`--gradient-gold-brushed`) · `src/styles/components/buttons.css:3–5`
(`.btn-gold`) · `src/styles/base.css:59–72` (`.skip-link`)
**Selector:** every `.btn-gold`, `.btn-gold--block`, `.btn-select-division`, and `.skip-link`

**axe reports nothing here and cannot** — it samples one computed background colour per element and
has no model of a gradient. Measured by hand against each stop of
`linear-gradient(135deg, #f7e5b2 0%, #ba9857 25%, #a1814c 50%, #87693b 75%, #72542b 100%)` with the
label colour `#050504`:

| Stop | Colour | Ratio | Verdict at 14–16px |
| :--- | :--- | ---: | :--- |
| 0% | `#f7e5b2` | 16.32 | ✅ |
| 25% | `#ba9857` | 7.49 | ✅ |
| 50% | `#a1814c` | 5.59 | ✅ |
| 75% | `#87693b` | **3.99** | ❌ below 4.5 |
| 100% | `#72542b` | **2.93** | ❌ below 3.0 — fails even the large-text floor |

The gradient runs at 135°, so the failing quarter is the bottom-right corner of every gold button.
A centred label's trailing characters sit over the 60–80% band. This affects the site's **primary
call to action on every page**, and the **skip link itself**, which shares the same gradient.

**This needs a design decision — `context/ui-standards.md` owns the tokens, and SPEC-008 says to
raise a brand-gold contrast failure rather than silently darken the palette. Decision requested.**
Two options that preserve the brushed-metal look:

- **(a) Clamp the ramp for interactive faces.** Introduce `--gradient-gold-brushed-ui` that stops at
  `#a1814c` (5.59:1) instead of running to `#72542b`, and use it for `.btn-gold`,
  `.btn-select-division` and `.skip-link` only. Display surfaces keep the full ramp.
- **(b) Keep the gradient, change the label.** `#ffffff` on `#72542b` is 5.99:1 and on `#87693b` is
  4.44:1 — still short at the 75% stop, so (a) is the sounder fix.

Until this is resolved, the primary CTA does not meet the AA baseline
`context/ui-standards.md` claims.

**Related, and already fine:** `.gold-gradient-text` (`src/styles/utilities.css:12`) uses the
*vertical* `--gradient-gold-metallic`, whose last stop `#72542b` measures 2.93:1 on `#050504`. It is
applied only to display headings (`.hero-heading` span, `.metric-val`) where the large-text floor is
3.0 — so the bottom sliver of each glyph is **marginally** under. Worth a look when (a) is
implemented; not worth a separate change.

<a id="a11y-06"></a>
### A11Y-06 · `/invoice` scrolls horizontally at 320px — **Moderate**

**WCAG:** 1.4.10 Reflow (AA)
**File:** `src/styles/components/legal.css:81–87` (`.inv-moved`) · content at
`src/templates/invoice/page.mjs:29`

**Measured at 320 × 640:** `documentElement.scrollWidth` = **339px** against `clientWidth` = 320px.
Offending elements: the `<h1>`, the surrounding `<p>`s and the portal `<a>` — all reported at
`right: 339px`.

Cause: the link text is the bare host-and-path string
`app.fusedprotectiveservices.com/portal/invoices`, which contains no break opportunity, so it cannot
wrap inside the 320px column.

**Fix:**

```css
/* src/styles/components/legal.css, with the other .inv-moved rules */
.inv-moved a {
    color: var(--logo-gold-highlight);   /* also fixes A-03 */
    overflow-wrap: anywhere;
}
```

`overflow-wrap: anywhere` lets the URL break mid-token at narrow widths and changes nothing at
desktop width.

**All other pages pass**: `/`, `/careers`, `/privacy` show no horizontal scroll at 320px, and all
four tested pages are clean at 200% zoom (640 × 400 and 640 × 512 CSS px).

<a id="a11y-07"></a>
### A11Y-07 · Portal `/login` has no heading and no `<main>` landmark — **Moderate** · ✅ fixed in code (SPEC-012)

**WCAG:** 2.4.6 Headings and Labels (AA); 1.3.1 Info and Relationships (A)
**File:** `app/src/app/login/page.tsx`

> **Fixed 2026-09-14 by SPEC-012:** `/login` and `/login/mfa` now render `<main id="main">`, and `/login`
> has a visible `<h1>Sign in</h1>` (`/login/mfa` already had one). Re-scan with the seeded capture
> suite before closing this finding. The original observation is kept below.

axe reports **zero violations** on this page at the WCAG AA tag set, and that is a true result — the
relevant axe rules (`page-has-heading-one`, `landmark-one-main`, `region`) sit under axe's
`best-practice` tag, which is deliberately not in our tag list. Found by manual inspection:

| Property | Observed |
| :--- | :--- |
| `<h1>` | **none** |
| Any heading (`h1`–`h4`) | **none at all** |
| `<main>` landmark | **absent** |
| Skip link | absent (defensible — the page is short) |
| `<title>` | ✅ "Sign in — FUSED Portal" |
| `lang` | ✅ `en` |
| Live region for sign-in feedback | ✅ `<p role="status">` |
| Email field label + `autocomplete="email"` | ✅ |
| Horizontal scroll at 320px | ✅ none |
| Tab order | ✅ sensible: role toggles → email → submit → phone → dispatch email |

A screen-reader user landing on the sign-in page has no heading to orient with and no main landmark
to jump to.

**Fix (for whoever owns `app/src/app/login/page.tsx` after SPEC-002 lands):** wrap the sign-in card
in `<main>` and give the page a visible `<h1>` — the existing "Sign in" wording is fine; if the
design has no room for a visible heading, use a `.visually-hidden` one (the utility already exists at
`src/styles/utilities.css:20` for the static site; the portal needs its own equivalent).

<a id="a11y-08"></a>
### A11Y-08 · Filtering the job board is announced to nobody — **Moderate**

**WCAG:** 4.1.3 Status Messages (AA)
**File:** `js/modules/careers.mjs:37–44`
**Selector:** `/careers` → `#positionsContainer`

Measured: choosing "Armed Patrol" correctly hides the non-matching cards (`hidden` is applied, so
they leave the accessibility tree — that part is right) and leaves `pos-patrol` visible. But
`#open-postings` contains **0 elements with `aria-live`, `role="status"` or `role="alert"`**, so a
screen-reader user hears the button's new pressed state and nothing about the list that just changed
size beneath it.

**Fix:** add a polite live region to `src/templates/careers/positions.mjs`, just before
`#positionsContainer`:

```html
<p class="visually-hidden" id="positionsCount" role="status" aria-live="polite"></p>
```

and write to it at the end of the `cards.forEach` block in `js/modules/careers.mjs:44`:

```js
const shown = [...cards].filter((c) => !c.hidden).length;
const region = document.getElementById('positionsCount');
if (region) region.textContent = `${shown} position${shown === 1 ? '' : 's'} shown.`;
```

`.visually-hidden` already exists in `src/styles/utilities.css:20`.

<a id="a11y-09"></a>
### A11Y-09 · Protocol tabpanels lack the `tabindex="0"` the standards document claims — **Minor**

**File:** `src/templates/protocol.mjs:20`
**Selector:** `/` → `#stagePanel0` … `#stagePanel3`
**Measured:** all four panels report `tabindex` = *absent*.

`context/ui-standards.md` § "ARIA Tablist Pattern" states: *"Tab panels: `role="tabpanel"`,
`tabindex="0"`, `aria-labelledby="tab-id"`."* The first and third are present; the second is not.

Low severity because each panel does contain a focusable `<a href="#quote">`, so the content is
reachable — the APG only requires `tabindex="0"` on panels with no focusable children. But the
documented standard and the implementation disagree, and the doc is what the next author will trust.

**Fix — pick one and make both agree:**

```diff
  src/templates/protocol.mjs:20
-                     role="tabpanel" aria-labelledby="stageTab${index}"${index === 0 ? '' : ' hidden'}>
+                     role="tabpanel" tabindex="0" aria-labelledby="stageTab${index}"${index === 0 ? '' : ' hidden'}>
```

…or amend `context/ui-standards.md` to drop the `tabindex="0"` claim. The markup fix is cheaper and
more robust to the CTA being removed later.

<a id="a11y-10"></a>
### A11Y-10 · Estimator slider label re-announces its own value — **Minor**

**File:** `src/templates/estimator.mjs:39–42` and `:48–51`
**Selector:** `/` → `label[for="guardRange"]`, `label[for="hoursRange"]`

The `<label>` wraps both the static text and the live value span, so the slider's accessible name
computes to **"Officers Needed: 15 Officers"** and changes on every arrow press. A screen reader
therefore announces the name *and* the native value: *"Officers Needed: 15 Officers, slider, 15"*,
and re-announces the whole string on each increment.

**Keyboard operation itself is exemplary** and needs no change — verified
<kbd>←</kbd>/<kbd>→</kbd> step by 1, <kbd>PageUp</kbd>/<kbd>PageDown</kbd> page, <kbd>Home</kbd>→1,
<kbd>End</kbd>→15, with `#calculatedTotal` (`role="status"`) updating live.

**Fix:** move the live value out of the label and point the slider at both with `aria-labelledby`:

```diff
- <label class="control-header" for="guardRange">
-     <span>Officers Needed:</span>
-     <span id="guardCountText" class="font-mono control-value">…</span>
- </label>
+ <div class="control-header">
+     <label id="guardRangeLabel" for="guardRange">Officers Needed:</label>
+     <span id="guardCountText" class="font-mono control-value" aria-hidden="true">…</span>
+ </div>
```

and add `aria-valuetext="${ranges.officers.value} Officers"` to the input, kept in sync by
`js/modules/estimator.mjs` alongside the existing `#guardCountText` update. `.control-header` is a
layout class, so swapping the element keeps the design.

<a id="a11y-12"></a>
### A11Y-12 · `.forge-cue-arrow` relies on the blanket reduced-motion clamp — **Minor**

**File:** `src/styles/components/forge.css` — the
`@media (prefers-reduced-motion: reduce)` block names `.forge-continue-arrow` only.

Measured under `prefers-reduced-motion: reduce`:

| Element | `animation-name` | `animation-duration` | `iteration-count` |
| :--- | :--- | :--- | :--- |
| `.forge-continue-arrow` | `none` | 1e-05s | 1 |
| `.forge-cue-arrow` | **`forgeNudge`** | 1e-05s | 1 |
| `.pulse-dot` | `pulseWave` | 1e-05s | 1 |

**This is not a defect** — `src/styles/base.css:84–90` clamps every animation to `0.01ms` with
`animation-iteration-count: 1 !important`, so `.forge-cue-arrow` and `.pulse-dot` are visually
static. It is an inconsistency: one of two identical arrows gets an explicit `animation: none` and
its twin does not, which will read to the next author as if one of them was missed.

**Fix (tidy-up):** add `.forge-cue-arrow` to the existing selector list in `forge.css`.

---

<a id="part-c"></a>
## Part C — Verified as working (do not "fix" these)

Recorded so wave 3 does not spend effort re-deriving them, or change something that is already right.

| Area | Result |
| :--- | :--- |
| **Skip link is the first focusable element** | ✅ **all six pages.** Verified by driving Chromium (first <kbd>Tab</kbd> from load) and locked in by `tests/skip-link.test.mjs`. |
| **Mobile drawer** | ✅ **exemplary.** Opens on <kbd>Enter</kbd>, focus moves to the close button, **12 consecutive <kbd>Tab</kbd>s all stayed inside**, <kbd>Esc</kbd> closes, focus is **restored to the opener**, `aria-expanded` flips `true`→`false`, `hidden` reapplied. `js/modules/drawer.mjs`. |
| **Protocol ARIA tablist** | ✅ **fully correct.** <kbd>→</kbd>/<kbd>←</kbd> wrap, <kbd>Home</kbd>/<kbd>End</kbd> jump, `aria-selected` and roving `tabindex` track together, panels toggle `hidden`, and the whole set is **exactly one tab stop** (measured across 30 Tabs). `js/modules/protocol.mjs`. Use this as the reference implementation for A11Y-03. |
| **Divisions bookshelf** | ✅ Rails are real `<button>`s, <kbd>Enter</kbd> expands, `aria-expanded` correct across all 7 spines, and closed payloads are `visibility: hidden` — so the collapsed "Deploy Division" buttons are genuinely **out of the tab order**, not just invisible. |
| **Assessment quiz** | ✅ Keyboard-operable end to end; focus follows automatically to step 2 on selection; the result region is `role="status"` and carries a real recommendation. |
| **Estimator sliders** | ✅ Native `<input type="range">`: arrows, <kbd>PageUp</kbd>/<kbd>PageDown</kbd>, <kbd>Home</kbd>/<kbd>End</kbd> all work; totals update in a `role="status"` region. (Naming nit only — A11Y-10.) |
| **Careers accordion** | ✅ `aria-expanded` toggles, the panel's `hidden` toggles with it, and the button's visible label switches between "View"/"Hide Requirements & Duties". |
| **Form labelling** | ✅ **11/11** intake fields have a programmatic `<label for>`. (Errors are the gap — A11Y-04.) |
| **Honeypot** | ✅ `#formWebsite` is `tabindex="-1"` inside `aria-hidden="true"` — correctly invisible to both keyboard and AT, and correctly *not* flagged by `aria-hidden-focus`. ⚠️ If the `tabindex="-1"` is ever removed, that rule fires immediately. |
| **`prefers-reduced-motion`** | ✅ Reveals lifted (`opacity: 1`, no wait on intersection); transitions clamped to 1e-05s; careers hero entrance 0.9s → 1e-05s; forge track collapsed to 120vh; ambient canvas draws a single still frame (`js/modules/ambient.mjs` `reset()`); cursor spotlight and emblem tilt return early. |
| **200% zoom** | ✅ No horizontal scroll and nothing clipped on `/`, `/careers`, `/privacy`, `/invoice` at 640×400 and 640×512 CSS px. |
| **320px viewport** | ✅ Clean on `/`, `/careers`, `/privacy`. (Only `/invoice` fails — A11Y-06.) |
| **Focus indicator** | ✅ `base.css:77` gives every interactive element a 2px `--logo-gold-specular` ring. Measured **15.03:1** against the card surface. ⚠️ **`outline-offset: 3px` is load-bearing**: the same ring measures only **2.18:1** directly against a gold button face (`#ba9857`), below the 3:1 non-text minimum. The offset is what puts it on the dark background. **Do not remove the offset.** |
| **Placeholder flag contrast** | ✅ The now-always-visible flag GUARDRAIL shipped measures **5.04:1** (`#ef4444` on its own 12% crimson wash over the footer) at 10px bold, clearing the 4.5 requirement. axe flagged it on no page. ⚠️ On an elevated card (`#111211`) the same pairing computes 4.46:1 — just under. If the flag is ever placed on a card surface, re-measure. |
| **Portal `/login`** | ✅ **Zero axe violations** at both 1280×800 and 320×640. (Structural gaps — A11Y-07.) |
| **`lang` and `<title>`** | ✅ Present and correct on all six static pages and the portal. |

<a id="part-c-intro"></a>
### The scroll-driven intro — the highest-risk item, and it passes

**SPEC-008 requirement:** *"it must be possible to reach the content without scrolling — by keyboard
alone, and with the skip link. A visitor who cannot perform a scroll gesture must not be trapped at
the top of the page."*

**Verdict: not trapped. Verified both ways, against the full-length intro.**

This needed care to test honestly. Headless Chromium cannot reach the Three.js CDN, so
`js/logo-forge.js` sets `data-forge-fallback` and `forge.css` collapses `.forge-track` from `350vh`
to `120vh` — which is *not* the experience a real visitor gets. The measurements below force the
track back to its real `350vh` (2800px at an 800px viewport, putting the hero **3.5 viewport-heights
below the fold**) before testing.

**By keyboard alone,** from a cold load at `scrollY = 0`:

| Tab | scrollY | Lands on |
| ---: | ---: | :--- |
| 1 | 0 | `.skip-link` |
| 2–11 | 0 | brand link, 8 nav pills, dispatch number |
| **12** | **0 → 2999** | **`.btn-gold` "Request Immediate Security Detail"** — hero CTA, `rectTop: 369px`, fully on screen |
| 13 | 2999 | `.btn-secondary-glass` "60-Sec Threat Assessment" |
| 14 | 3817 | first bookshelf spine rail |

The twelfth <kbd>Tab</kbd> jumps the full 2800px track in one move. An `elementFromPoint` check at
the focused button's centre returns the button itself — it is **not** covered by the sticky
`.forge-stage`: `.forge-track` carries `pointer-events: none` (`forge.css:25`) and the ambient
canvas sits at `z-index: -1` (`base.css:31`), so neither intercepts the hero.

**By skip link:** activating it scrolls to `scrollY = 3689`, putting `#capabilities` exactly at the
viewport top.

**There is no scroll hijacking.** `js/logo-forge.js` binds `scroll` listeners passively and never
calls `scrollTo` or `preventDefault`, so nothing fights the browser's focus scrolling.

⚠️ **One caveat for whoever measures this next:** `base.css:9` sets `scroll-behavior: smooth`, so the
2800px jump is animated over roughly a second. An automated check that samples the scroll position
sooner than that will read a position mid-flight and wrongly conclude the focused element is
off-screen. Allow the scroll to settle (≥1.4s) before asserting. Under `prefers-reduced-motion`,
`base.css:86` switches to `scroll-behavior: auto` and the jump is instant.

The remaining gap is not reachability but *destination* — the skip link lands past the hero
(A11Y-01). Fixing that makes this section unambiguous.

---

<a id="part-d"></a>
## Part D — The `data-placeholder` escaping defect: confirmed, and it does **not** reach the accessibility tree

<a id="a11y-11"></a>
**A11Y-11** · **Minor** · Verified rather than rediscovered, as asked.

**Files:** `src/templates/footer.mjs:40` and `src/templates/partials.mjs:26`

```js
// footer.mjs:40
<p class="footer-license"${site.licenseNumber.placeholder ? ' data-placeholder="license"' : ''}>
// partials.mjs:26
<a href="tel:${site.phone.e164}" class="${className}"${site.phone.placeholder ? ' data-placeholder="phone"' : ''}>
```

Both interpolate a **whole attribute string** through the escaping `html` tag. `src/lib/html.mjs:31`
escapes `"` to `&quot;` in every interpolation by design, so the generated output is:

```html
<p class="footer-license" data-placeholder=&quot;license&quot;>
```

Present in `index.html:1103`, `careers.html:1086`, `privacy.html:136`, `terms.html:140`,
`sms-consent.html:128`.

**What actually happens in the browser** (measured, not reasoned about):

| Check | Result |
| :--- | :--- |
| Parsed attribute value | `"license"` — **including two literal `"` characters** |
| `element.dataset.placeholder` | `"\"license\""` |
| `document.querySelector('[data-placeholder="license"]')` | ❌ **does not match** |
| `document.querySelector('[data-placeholder]')` | ✅ matches |
| Computed `outline-style` on `.footer-license` | ✅ `dashed` — the guardrail outline still paints |
| **Accessibility tree impact** | ✅ **none** |

**Verdict: this is a correctness bug, not an accessibility defect.** `data-*` attributes are not
mapped into the accessibility tree by any browser or screen reader, so nothing about this reaches
assistive technology. The visible guardrail is intact by luck: `src/styles/components/placeholder.css`
selects on the bare `[data-placeholder]`, which still matches, and the `.placeholder-flag` element
that carries the human-readable text is a separate `<span role="note">Placeholder licence number</span>`
that is correctly exposed and clears AA contrast at 5.04:1 (see Part C).

**It is still worth fixing**, because the next person to write
`[data-placeholder="license"] { … }` will get a rule that silently never matches:

```js
// footer.mjs:40 — interpolate the VALUE, not the whole attribute
<p class="footer-license"${raw(site.licenseNumber.placeholder ? ' data-placeholder="license"' : '')}>
```

or, avoiding `raw()` entirely and keeping escaping on by default:

```js
<p class="footer-license" data-placeholder="${site.licenseNumber.placeholder ? 'license' : ''}">
```

(the second always emits the attribute, so `placeholder.css` would need `[data-placeholder]:not([data-placeholder=""])`).

**Not fixed here** — `src/templates/**` is locked by SPEC-007 this wave, and this belongs with
GUARDRAIL's SPEC-001 lineage rather than with the accessibility gate.

---

<a id="part-e"></a>
## Part E — Prioritised fix list for wave 3

Ordered by severity, then by cost-to-benefit. Items 1–4 clear **all 48** automated violations and
let the `a11y` job flip to blocking.

| # | ID | Severity | Change | Files | Blocks the gate? |
| :-- | :--- | :--- | :--- | :--- | :--: |
| 1 | A-01 | Serious | `--text-tertiary: #78716c` → `#8f8a86` — **clears 42 of 48 nodes** · **applied 2026-09-14** | `src/styles/tokens.css:42` | ✅ |
| 2 | A-02 | Serious | `.standard-index` alpha `0.35` → `0.62` | `src/styles/components/standards.css:46` | ✅ |
| 3 | A-03 + A11Y-06 | Serious | Add `.inv-moved a { color: var(--logo-gold-highlight); overflow-wrap: anywhere; }` | `src/styles/components/legal.css` | ✅ |
| 4 | A-04 | Serious | `.estimator-disclaimer` `#64748b` → `var(--text-tertiary)` | `src/styles/components/estimator.css:158` | ✅ |
| 5 | A11Y-01 | Serious | Retarget both skip links to `#main` | `src/templates/page.mjs:74`, `src/templates/careers/page.mjs:48` | — |
| 6 | A11Y-02 | Serious | `tabindex="-1"` on all four `<main>`/skip targets | 4 page templates | — |
| 7 | A11Y-04 | Serious | Programmatic error association on both intake forms | `src/templates/quote.mjs`, `src/templates/careers/apply.mjs`, `js/modules/quote-form.mjs`, `js/modules/careers.mjs`, `src/styles/components/form.css` | — |
| 8 | A11Y-05 | Serious | **Decision needed** — clamp the gold ramp for interactive faces | `src/styles/tokens.css`, `context/ui-standards.md` | — |
| 9 | A11Y-03 | Serious | Careers filter: `tablist`/`tab`/`aria-selected` → `group`/`aria-pressed` | `src/templates/careers/positions.mjs`, `js/modules/careers.mjs` | — |
| 10 | A11Y-07 | Moderate | Portal `/login`: add `<main>` and an `<h1>` | `app/src/app/login/page.tsx` *(SPEC-002's lane)* | — |
| 11 | A11Y-08 | Moderate | Live region for the job-board filter count | `src/templates/careers/positions.mjs`, `js/modules/careers.mjs` | — |
| 12 | A11Y-09 | Minor | `tabindex="0"` on protocol tabpanels (or amend the standards doc) | `src/templates/protocol.mjs:20` | — |
| 13 | A11Y-10 | Minor | Move the live value out of the slider labels; add `aria-valuetext` | `src/templates/estimator.mjs`, `js/modules/estimator.mjs` | — |
| 14 | A11Y-11 | Minor | Stop double-escaping the `data-placeholder` attribute | `src/templates/footer.mjs:40`, `src/templates/partials.mjs:26` | — |
| 15 | A11Y-12 | Minor | Add `.forge-cue-arrow` to the reduced-motion selector list | `src/styles/components/forge.css` | — |

**Every style and template change above must be made in `src/` and followed by `node build.mjs`,
committing source and regenerated output together** (specs/README.md invariant 1).

### Arming the gate

Once 1–4 land and both axe passes report zero:

1. Delete `continue-on-error: true` from the `a11y` job in `.github/workflows/ci.yml` (and the
   comment block explaining it).
2. Add `a11y` to the repository's required-checks list.
3. Tighten `tests/skip-link.test.mjs` to assert the target is `#main` exactly (currently it asserts
   only that the target resolves to an id inside `<main>`, because A11Y-01 is still open).

---

<a id="part-f"></a>
## Part F — Deliberately not done this wave

- **No fixes were applied.** `src/templates/**` and `src/styles/**` are locked by SPEC-007 this wave
  and SPEC-006 rewrites the styles next; two agents editing the same tokens would cost more than it
  gains. SPEC-008 asks for fix-and-gate in one change, and this splits that in two — the audit above
  is precise enough (file, line, selector, rule id, exact replacement value) that the follow-up is
  mechanical.
- **Screen-reader passes (VoiceOver/Safari, NVDA/Firefox)** — SPEC-008 design 4 asks for these and
  they cannot be run in this environment. What *can* be checked programmatically has been: roles,
  accessible names, live regions, `hidden` state, focus order and the accessibility tree. The
  `#formStatus` live region is correctly marked `role="status" aria-live="polite"` and does receive
  the reference code on success — but that it is *spoken* is unverified, and A11Y-04 shows it is
  never written to on failure.
- **Seeded-session portal screens** (dashboard, leads, quote editor, invoice) — SPEC-008 design 2
  names five screens; only signed-out `/login` is scanned. The rest need the test-database harness
  (`app/scripts/reset-test-db.mjs`) and a seeded session wired into the `a11y` job.
  `app/tests/a11y.test.ts` is structured so adding them is a matter of extending its `SCREENS` array.
- **`context/ui-standards.md` was not amended.** SPEC-008's test plan asks for a standing obligation
  to re-run this audit whenever a component in design 4 changes. Requested wording for whoever owns
  that file:
  > **Standing obligation.** Any change to the nav or drawer, the bookshelf, the protocol tablist,
  > the assessment quiz, the estimator, either intake form, the careers filters or accordion, or the
  > scroll-driven intro requires re-running the manual audit in `docs/A11Y-AUDIT.md` and updating its
  > date. The `a11y` CI job covers the automated third; it does not cover any of the above.

  It should also record the A11Y-05 decision once made, since it owns the gold tokens.
