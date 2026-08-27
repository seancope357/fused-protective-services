# PROJECT_CONTEXT — Fused Protective Services

The definitive build blueprint for this repository. Read this before changing anything.

**Client:** Cameron Harrell / Fused Protective Services (Austin, TX)
**What it is:** A single-page marketing and security-detail intake site.
**Cascade role:** None recorded. This is client/consulting work; it does not currently
carry a rung on the Friday Check scoreboard.

---

## The one rule

**`index.html` and `css/site.css` are generated. Never edit them by hand.**

Everything the page says lives in `src/`. Run `node build.mjs` after any change and
commit the regenerated output alongside the source.

```bash
node build.mjs           # write index.html and css/site.css
node build.mjs --check    # fail if the committed output drifted from src/
python3 serve.py          # preview at http://localhost:5050
```

There is no `package.json`, no lockfile, and no dependency to install. `node build.mjs`
is the entire toolchain, matching the convention already used in `pixel-scroll-forge`.
The generated files are committed so the site still deploys by dragging the directory
at Vercel, Netlify, or Cloudflare Pages.

---

## Layout

```text
├── build.mjs                  the whole toolchain
├── index.html                 GENERATED
├── css/site.css               GENERATED
├── src/
│   ├── lib/html.mjs           escaping tagged template — the base of everything
│   ├── data/                  every fact the site states
│   │   ├── site.mjs           brand, contact, nav, metrics, standards, SEO copy
│   │   ├── divisions.mjs      the six divisions  ← single source of truth
│   │   ├── protocol.mjs       the four deployment phases
│   │   ├── assessment.mjs     quiz questions, answers, and their routing
│   │   ├── estimator.mjs      tiers, rates, slider ranges
│   │   ├── intake.mjs         armed-preference vocabulary
│   │   ├── faq.mjs            questions and answers
│   │   └── icons.mjs          the tactical SVG emblem library
│   ├── templates/             one module per section
│   └── styles/                one module per component, none over 300 LOC
├── js/
│   ├── app.mjs                entry; initialises every widget
│   ├── modules/               one module per interactive surface
│   └── logo-forge.js          the scroll-forged emblem (WebGL)
└── assets/
    ├── logo.png               the brand plate; also the voxel source
    └── o-scroll.html          the original Pixel Scroll Forge output (reference)
```

---

## Why the data layer exists

The six divisions used to be hand-maintained in **five** places: the bookshelf spines,
the quote form `<select>`, the schema.org `OfferCatalog`, the assessment mapping, and
the estimator mapping. They had already drifted — the catalog listed four services where
the site sells six, so two divisions were invisible to search engines and AI crawlers.
The FAQ had drifted the same way: four questions on the page, three in the structured data.

Adding a seventh division is now one object in `src/data/divisions.mjs`. It renders into
the spines, the form, and the structured data at once. The same holds for the FAQ, the
protocol phases, the estimator tiers, and the phone number.

`quoteValue` on a division is the contract between the spine's deploy button, the form
`<select>` option, and the assessment/estimator pre-fill. **Keep it stable** — changing
it changes what the operations team receives.

---

## Decisions that constrain future work

- **Escaping is the default, not the opt-in.** `html` from `src/lib/html.mjs` escapes
  every interpolated value. Use `raw()` only on markup this repo generates. Never put an
  HTML entity (`&amp;`) in a data field — write the literal character and let the
  template escape it, or it will double-escape.
- **The client's data comes from the build.** `src/templates/page.mjs` serializes the
  slice the browser needs into a `<script type="application/json" id="fps-config">`
  island. Browser modules read it via `js/modules/config.mjs`. Never hard-code a
  division name, rate, or recommendation in `js/`.
- **No inline event handlers, no inline styles.** The page ships zero of each. Widgets
  bind by `data-` attribute through delegated listeners.
- **CSS is layered.** `@layer tokens, base, layout, components, utilities` is declared
  once at the top of the generated stylesheet, so a component can never accidentally
  out-specify a utility. Cascade order within `components` is the explicit
  `STYLE_ORDER` list in `build.mjs`, not alphabetical.
- **Cascade order inside a module matters.** A rule appended after a `@media` block
  overrides it at that breakpoint. `src/styles/components/bookshelf.css` documents one
  live instance: the `.spine-rail` button reset must sit *ahead* of the 992px block.
- **`copyrightYear` is stated, not read from the clock.** A build must produce the same
  bytes today and next January, or `--check` starts failing on a date rather than on a
  change.
- **The assembly intro publishes two clocks.** `--assembly` is scroll position, which is
  what the copy beats ride. `--assembly-settled` is where the camera actually is, and is
  the only one anything may use to assert completion — `--assembly` reaches 1 the instant
  the scroll does, while cubes are still arriving. This is a defect inherited from
  Pixel Scroll Forge, recorded in that project's vault entry, and corrected here.
- **Legibility over the animated canvas comes from panels and scrims only.**
  `mix-blend-mode` cannot reach the canvas — the `z-index: 1` content wrapper is its own
  stacking context.
- **`js/logo-forge.js` is deliberately left whole at ~530 lines**, past the usual
  300-line split. It is an adapted copy of the Pixel Scroll Forge engine, and that
  project's standing decision is that the effect is written in exactly one place. Slicing
  this copy into modules would make re-syncing an upstream fix (the frame-delta clamp, the
  seam overlap) a merge instead of a diff. Prefer porting upstream changes over
  restructuring it locally.

---

## Known gaps — Cameron's call

1. **The phone number is a placeholder.** `(512) 555-0199` sits in the block reserved for
   fiction. It is defined once in `src/data/site.mjs`; set `phone` there and the nav,
   drawer, dispatch bar, footer, and schema.org record all follow.
2. **The quote form does not transmit anywhere.** Submissions are recorded in the
   visitor's own browser only. `deliver()` in `js/modules/quote-form.mjs` is the single
   seam a real endpoint (Formspree, Web3Forms, or a custom handler) plugs into.
3. **`aggregateRating` claims 5.0 from 28 reviews** in the structured data. Search engines
   treat unverifiable review markup as a policy violation; this should be backed by real
   collected reviews or removed.

---

## Accessibility baseline

Established during the 2026-08-26 rebuild, and worth not regressing:

- Bookshelf rails and estimator tiers are real `<button>`s; they were `<div onclick>`.
- The protocol hub is an ARIA tablist with arrow-key navigation.
- The FAQ is `<details>`/`<summary>`, so open state and keyboard operation come from
  the platform.
- Every form control has an associated `<label for>`; previously the labels were
  unassociated text and screen readers announced the inputs unnamed.
- A skip link, one visible `:focus-visible` treatment, and a global
  `prefers-reduced-motion` block are defined in `src/styles/base.css`.
- The quiz result and the form confirmation are live regions. The form confirmation
  replaced a blocking `alert()`.
