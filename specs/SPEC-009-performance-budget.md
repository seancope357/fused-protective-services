# SPEC-009 — Performance budget for the assembly intro
**Gate:** GO_LIVE.md → E3 · **Surface:** static site
**Size:** M · **Depends on:** SPEC-006, SPEC-007 · **Human blocker:** none

## Why

The landing page opens on a scroll-driven WebGL sequence that assembles **~65,000 voxel
cubes** (`js/logo-forge.js`), on top of an ambient particle canvas and a cursor spotlight.
Before this spec's dependencies land, a first view also carries a 1.07 MB logo, an 84 KB
stylesheet, an 80 KB HTML document, and three.js plus three font families from two external
CDNs.

Nothing measures any of it, and there is no budget to measure against. The likely visitor
is on a phone, possibly on mobile data, possibly searching for a security contractor
urgently — the exact conditions the current page is least suited to. A conversion funnel
that loses people before the hero paints cannot be fixed by anything further down it.

Run this **after** SPEC-006 (self-hosted three.js and fonts) and SPEC-007 (asset weight),
or you will measure and tune a page that is about to change underneath you.

## Scope

**In**
- A stated, enforced budget.
- Repeatable measurement on representative hardware.
- Whatever tuning is needed to meet the budget, adaptive rendering included.
- Verifying the existing fallbacks look deliberate rather than broken.

**Out**
- Redesigning the intro or cutting the WebGL sequence. It is the brand.
- Server-side rendering or a framework. The site is static by design.
- Portal performance — internal, authenticated, not on this critical path.

## Design

**1 · The budget**, asserted in CI, measured on a simulated mid-tier Android over 4G:

| Metric | Budget |
| :--- | :--- |
| LCP | ≤ 2.5 s |
| CLS | ≤ 0.1 |
| INP | ≤ 200 ms |
| First-view transfer | ≤ 900 KB, of which ≤ 250 KB script |
| Main-thread blocking | ≤ 300 ms |
| Lighthouse Performance | ≥ 85 mobile |

These are the thresholds, not aspirations — CI fails below them. If a number proves
genuinely unreachable without cutting the intro, bring the evidence and we change the
number deliberately rather than quietly ignoring it.

**2 · Measurement.** Lighthouse CI via `npx` (pinned) in a new job, same constraint as
SPEC-008: no root dependency. Mobile preset, throttling on, three runs, median. Budgets in
`lighthouse-budget.json`. Run it against `python3 serve.py`, so the measured artefact is
exactly what is committed.

**3 · Likely levers, in the order to try them.**

- **Adaptive cube count.** 65k cubes is a desktop GPU number. Scale from
  `navigator.hardwareConcurrency`, `devicePixelRatio` and viewport — something like 65k
  desktop, 25k tablet, 12k phone. The emblem must still read as the emblem at every level;
  that is the acceptance bar, not the count itself.
- **Defer the forge.** Nothing about the intro needs to block first paint. Load
  `logo-forge.js` after the hero has painted, with the static emblem in place until it is
  ready — the fallback plate already exists, so this is mostly sequencing.
- **Trim the stylesheet.** 84 KB is large for one page. Inline the above-the-fold subset
  and defer the rest, or split per page — `careers.css` is compiled into the same bundle
  today and the landing page does not need it.
- **`content-visibility: auto`** on below-the-fold sections.
- **Idle work.** The ambient canvas and cursor spotlight start after the hero is
  interactive, never before.

Take them in order and stop when the budget is met. Do not do all five reflexively.

**4 · Fallbacks must look intentional.** Three states, each checked on a real small screen:
WebGL unavailable (`data-forge-fallback`), `prefers-reduced-motion`, and JavaScript
disabled entirely. In every one the page must be complete, legible and convertible — the
quote form reachable and submittable. A degraded page that looks broken costs more than the
animation earns.

**5 · Record the numbers.** `docs/PERF-BUDGET.md`: the budget, the method, the baseline
before this spec, and the numbers after. Without a recorded baseline the next regression
has nothing to be a regression from.

## Acceptance

1. The Lighthouse CI job runs on every PR and fails when any budget is exceeded.
2. Every metric in design 1 is met on the mobile preset at merge.
3. The emblem reads correctly at every adaptive cube level — screenshots for each in the PR.
4. First paint does not wait on three.js.
5. All three fallback states render a complete, usable page with a working quote form.
6. `prefers-reduced-motion` clamps the assembly, reveals, ambient canvas and spotlight.
7. The dual-clock contract still holds: `--assembly` tracks scroll, `--assembly-settled`
   tracks camera arrival, and only the latter claims completion. Adaptive cube counts must
   not let `--assembly-settled` fire early.
8. `docs/PERF-BUDGET.md` records baseline and post numbers.
9. No visual regression at desktop sizes.

## Test plan

- Lighthouse CI with `lighthouse-budget.json`, three runs, median, in the new job.
- `tests/` unit test over the cube-count selector: given a device profile, the expected
  tier — so the tiering cannot silently collapse to one branch.
- Manual matrix, recorded in the PR: mid-tier Android on throttled 4G, desktop, reduced
  motion, WebGL disabled, JS disabled.
- Re-run SPEC-008's a11y job; deferring and `content-visibility` can both affect focus
  order and the accessibility tree.

## Files

`.github/workflows/ci.yml` · `lighthouse-budget.json` · `js/logo-forge.js` ·
`js/app.mjs` · `js/modules/ambient.mjs` · `build.mjs` (if the stylesheet is split) ·
`src/styles/**` · `src/templates/page.mjs` (script loading order) ·
`docs/PERF-BUDGET.md` · regenerated output

## Open decisions

- **Cube-count tiers:** the numbers above are a starting point. Measure and report what you
  actually chose and why; the acceptance bar is "the emblem reads", not a specific count.
- **Split the stylesheet per page?** *Recommended: only if the budget is not met without
  it.* It touches `STYLE_ORDER` and the cascade contract, which is a real risk for a
  possibly unnecessary saving.
- **If the budget cannot be met with the intro intact**, stop and bring the numbers. The
  intro is a deliberate brand decision (`context/ui-standards.md`) and is not an agent's to
  cut. Present the trade-off; let Sean and Cameron choose.
